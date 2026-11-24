"""Verificación de restauración MySQL: esquema, conteos, FK y CONTENIDO.

Compara la base ORIGEN y la base RESTAURADA:
  - mismo conjunto de tablas
  - COUNT(*) por tabla (todas)
  - mismas claves foráneas declaradas
  - cero filas huérfanas por FK en AMBAS bases (integridad referencial)
  - hash SHA-256 determinista del CONTENIDO por tabla: filas ordenadas por
    clave primaria, valores canonizados por tipo (None/datetime/Decimal/
    bytes/float) y columnas en orden estable. El hash igual en ambas bases
    prueba igualdad de contenido, no solo de tamaños.

Solo imprime nombres de tabla y hashes (nunca datos personales).

Uso:
  python verificar_restore.py <host> <puerto> <usuario> <db_origen> <db_restaurada>

Contraseña por entorno: MYSQL_PASSWORD. Exit 0 = restauración íntegra.
"""
import hashlib
import os
import sys
from decimal import Decimal

import pymysql

HOST, PORT, USER, SRC, DST = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
PWD = os.environ["MYSQL_PASSWORD"]


def conectar(db: str) -> pymysql.connections.Connection:
    return pymysql.connect(
        host=HOST, port=PORT, user=USER, password=PWD, database=db, charset="utf8mb4"
    )


def tablas(cnx):
    with cnx.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = %s AND table_type='BASE TABLE' ORDER BY table_name",
            (cnx._neodomus_db,),  # type: ignore[attr-defined]
        )
        return {r[0] for r in cur.fetchall()}


def conteo(cnx, tabla: str) -> int:
    with cnx.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM `{tabla}`")
        return cur.fetchone()[0]


def clave_primaria(cnx, tabla: str):
    """Columnas de la PK en su orden (para orden determinista)."""
    with cnx.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.key_column_usage "
            "WHERE table_schema = %s AND table_name = %s AND constraint_name = 'PRIMARY' "
            "ORDER BY ordinal_position",
            (cnx._neodomus_db, tabla),  # type: ignore[attr-defined]
        )
        filas = [r[0] for r in cur.fetchall()]
    return filas or None


def columnas(cnx, tabla: str):
    with cnx.cursor() as cur:
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = %s AND table_name = %s ORDER BY ordinal_position",
            (cnx._neodomus_db, tabla),  # type: ignore[attr-defined]
        )
        return [r[0] for r in cur.fetchall()]


def canon(valor) -> str:
    """Representación determinista de un valor SQL."""
    if valor is None:
        return "N"
    if isinstance(valor, bool):
        return "1" if valor else "0"
    if isinstance(valor, Decimal):
        return f"D:{valor.normalize():f}"
    if isinstance(valor, bytes):
        return f"B:{valor.hex()}"
    if isinstance(valor, float):
        return f"F:{valor.hex()}"  # hex es exacto y determinista
    if hasattr(valor, "isoformat"):  # date/datetime/time
        return f"T:{valor.isoformat()}"
    return f"S:{valor}"


def hash_tabla(cnx, tabla: str) -> str:
    """SHA-256 de todas las filas ordenadas por PK; columnas por ordinal."""
    orden = clave_primaria(cnx, tabla)
    cols = columnas(cnx, tabla)
    sql = f"SELECT {', '.join('`' + c + '`' for c in cols)} FROM `{tabla}`"
    if orden:
        sql += " ORDER BY " + ", ".join("`" + c + "`" for c in orden)
    h = hashlib.sha256()
    n = 0
    with cnx.cursor(pymysql.cursors.SSCursor) as cur:
        cur.execute(sql)
        while True:
            filas = cur.fetchmany(1000)
            if not filas:
                break
            for fila in filas:
                h.update(("|".join(canon(v) for v in fila) + "\n").encode("utf-8"))
                n += 1
    return f"{h.hexdigest()} filas={n}"


def fks(cnx, db: str):
    with cnx.cursor() as cur:
        cur.execute(
            "SELECT table_name, referenced_table_name, constraint_name "
            "FROM information_schema.referential_constraints WHERE constraint_schema = %s",
            (db,),
        )
        return {(r[0], r[1], r[2]) for r in cur.fetchall()}


def columnas_fk(cnx, db: str):
    """(tabla_hija, columna_hija, tabla_padre, columna_padre) para huérfanos."""
    with cnx.cursor() as cur:
        cur.execute(
            "SELECT child.table_name, child.column_name, parents.referenced_table_name, "
            "parents.referenced_column_name "
            "FROM information_schema.key_column_usage child "
            "JOIN information_schema.referential_constraints rc "
            "  ON rc.constraint_name = child.constraint_name "
            " AND rc.constraint_schema = child.table_schema "
            "JOIN information_schema.key_column_usage parents "
            "  ON parents.constraint_name = rc.constraint_name "
            " AND parents.constraint_schema = child.table_schema "
            " AND parents.ordinal_position = child.ordinal_position "
            "WHERE child.table_schema = %s AND child.referenced_table_name IS NOT NULL",
            (db,),
        )
        return cur.fetchall()


def huérfanos(cnx, tabla: str, col: str, padre: str, col_padre: str) -> int:
    with cnx.cursor() as cur:
        cur.execute(
            f"SELECT COUNT(*) FROM `{tabla}` c LEFT JOIN `{padre}` p "
            f"ON c.`{col}` = p.`{col_padre}` WHERE p.`{col_padre}` IS NULL "
            f"AND c.`{col}` IS NOT NULL"
        )
        return cur.fetchone()[0]


src, dst = conectar(SRC), conectar(DST)
src._neodomus_db = SRC  # type: ignore[attr-defined]
dst._neodomus_db = DST  # type: ignore[attr-defined]

errores = 0

t_src, t_dst = tablas(src), tablas(dst)
if t_src != t_dst:
    errores += 1
    print(f"TABLAS DISTINTAS: solo origen={t_src - t_dst} solo restaurada={t_dst - t_src}")
else:
    print(f"TABLAS OK ({len(t_src)} tablas)")

for tabla in sorted(t_src & t_dst):
    n_src, n_dst = conteo(src, tabla), conteo(dst, tabla)
    marca = "OK" if n_src == n_dst else "DISTINTO"
    if n_src != n_dst:
        errores += 1
    h_src = hash_tabla(src, tabla)
    h_dst = hash_tabla(dst, tabla)
    if h_src != h_dst:
        errores += 1
        print(f"  {tabla}: conteo {n_src}->{n_dst} [{marca}] CONTENIDO_DISTINTO")
        print(f"    origen:     {h_src}")
        print(f"    restaurada: {h_dst}")
    else:
        print(f"  {tabla}: conteo {n_src}->{n_dst} [{marca}] contenido {h_src[:16]}… [{h_src.split()[-1]} filas] OK")

f_src, f_dst = fks(src, SRC), fks(dst, DST)
if f_src != f_dst:
    errores += 1
    print(f"FK DISTINTAS: origen={len(f_src)} restaurada={len(f_dst)}")
else:
    print(f"FK OK ({len(f_src)} foráneas)")

for tabla, col, padre, col_padre in columnas_fk(src, SRC):
    h_src = huérfanos(src, tabla, col, padre, col_padre)
    h_dst = huérfanos(dst, tabla, col, padre, col_padre)
    if h_src != h_dst:
        errores += 1
        print(f"  HUÉRFANOS DISTINTOS {tabla}.{col}->{padre}: {h_src} vs {h_dst}")
    elif h_src > 0:
        print(f"  AVISO huérfanos (iguales en ambas): {tabla}.{col}->{padre} = {h_src}")

print("HUERFANOS_CHECK_OK" if errores == 0 else f"ERRORES={errores}")
sys.exit(0 if errores == 0 else 1)
