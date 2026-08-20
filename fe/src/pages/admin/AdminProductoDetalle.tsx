import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FaArrowLeft,
  FaCircleInfo,
  FaPen,
  FaTrash,
  FaFloppyDisk,
  FaXmark,
  FaTriangleExclamation,
  FaCirclePlus,
  FaUpload,
} from 'react-icons/fa6';
import '@styles/admin-panel.css';
import '@styles/dashboard-admin.css';
import api from '@services/api';
import { useIdioma } from '@i18n/IdiomaContext';
import { STOCK_MINIMO, badgeStock, textoStock } from '../../constants';
import type { ProductoAdmin, CategoriaAdmin, ProveedorAdmin, VarianteAdmin } from '../../types';

interface EstadoForm {
  nombre_producto: string;
  referencia_producto: string;
  precio_venta_producto: string;
  precio_compra_producto: string;
  id_cate_pr: string;
  id_proveedor_pr: string;
  imagen_url: string;
  colores_producto: string;
  stock_producto: string;
  estado_producto: string;
  descuento_activo: string;
  promocion_hasta: string;
  descripcion_producto: string;
  caracteristicas_producto: string;
  marca?: string;
  es_nuevo_producto: boolean;
  tecnicos_requeridos: string;
}

interface VarianteForm {
  id: number | null;
  nombre: string;
  hex: string;
  imagen_url: string;
  stock: string;
}

const VARIANTE_VACIA = (): VarianteForm => ({
  id: null,
  nombre: '',
  hex: '#d4a54b',
  imagen_url: '',
  stock: '0',
});

const VACIO: EstadoForm = {
  nombre_producto: '',
  marca: '',
  referencia_producto: '',
  precio_venta_producto: '',
  precio_compra_producto: '',
  id_cate_pr: '',
  id_proveedor_pr: '',
  imagen_url: '',
  colores_producto: '',
  stock_producto: '0',
  estado_producto: 'activo',
  descuento_activo: '',
  promocion_hasta: '',
  descripcion_producto: '',
  caracteristicas_producto: '',
  es_nuevo_producto: true,
  tecnicos_requeridos: '1',
};

const AdminProductoDetalle = () => {
  const { idioma, t } = useIdioma();
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id || id === 'nuevo';
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoriaParam = searchParams.get('categoria');
  const proveedorParam = searchParams.get('proveedor');
  const categoriaInicial = esNuevo && categoriaParam && /^\d+$/.test(categoriaParam) ? categoriaParam : '';
  const proveedorInicial = esNuevo && proveedorParam && /^\d+$/.test(proveedorParam) ? proveedorParam : '';

  const [producto, setProducto] = useState<ProductoAdmin | null>(null);
  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [proveedores, setProveedores] = useState<ProveedorAdmin[]>([]);
  const [form, setForm] = useState<EstadoForm>(() => ({
    ...VACIO,
    ...(categoriaInicial ? { id_cate_pr: categoriaInicial } : {}),
    ...(proveedorInicial ? { id_proveedor_pr: proveedorInicial } : {}),
  }));
  const [caractLista, setCaractLista] = useState<string[]>([]);
  const [colorLista, setColorLista] = useState<string[]>([]);
  const [variantesForm, setVariantesForm] = useState<VarianteForm[]>([]);
  const [editar, setEditar] = useState(esNuevo);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'err' } | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState({
    nombre_proveedor: '',
    contacto_proveedor: '',
    telefono_proveedor: '',
    correo_proveedor: '',
    direccion_proveedor: '',
  });
  const [guardandoProveedor, setGuardandoProveedor] = useState(false);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const varianteFileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const subirArchivo = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await api.post<{ url: string }>('/productos/upload-imagen', fd);
    return res.data.url;
  };

  const subirImagen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoImg(true);
    try {
      const url = await subirArchivo(file);
      setCampo('imagen_url', url);
      notify(t('adm.productoDetalle.notifyImagenSubida'));
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.productoDetalle.notifyImagenError'), 'err');
    } finally {
      setSubiendoImg(false);
      if (e.target) e.target.value = '';
    }
  };

  const subirImagenVariante = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoImg(true);
    try {
      const url = await subirArchivo(file);
      setVariante(i, 'imagen_url', url);
      notify(t('adm.productoDetalle.notifyVarianteImagenSubida'));
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.productoDetalle.notifyVarianteImagenError'), 'err');
    } finally {
      setSubiendoImg(false);
      if (e.target) e.target.value = '';
    }
  };

  const cargar = async () => {
    setCargando(true);
    setError(false);
    try {
      const [cats, prov] = await Promise.all([
        api.get<CategoriaAdmin[]>('/productos/categorias'),
        api.get<ProveedorAdmin[]>('/productos/proveedores'),
      ]);
      setCategorias(cats.data || []);
      setProveedores(prov.data || []);
      if (!esNuevo) {
        const res = await api.get<ProductoAdmin>(`/productos/${id}`);
        setProducto(res.data);
        setVariantesForm(
          (res.data.variantes || []).map((v: VarianteAdmin) => ({
            id: v.id,
            nombre: v.nombre,
            hex: v.hex || '#d4a54b',
            imagen_url: v.imagen_url || '',
            stock: String(v.stock ?? 0),
          })),
        );
        setForm({
          nombre_producto: res.data.nombre_producto || '',
          marca: res.data.marca || '',
          referencia_producto: res.data.referencia_producto || '',
          precio_venta_producto: res.data.precio_venta_producto?.toString() || '',
          precio_compra_producto: res.data.precio_compra_producto?.toString() || '',
          id_cate_pr: res.data.id_cate_pr?.toString() || '',
          id_proveedor_pr: res.data.id_proveedor_pr?.toString() || '',
          imagen_url: res.data.imagen_url || '',
          colores_producto: res.data.colores_producto || '',
          stock_producto: res.data.stock_producto?.toString() || '0',
          estado_producto: res.data.estado_producto || 'activo',
          descuento_activo: res.data.descuento_activo != null ? String(res.data.descuento_activo) : '',
          promocion_hasta: res.data.promocion_hasta || '',
          descripcion_producto: res.data.descripcion_producto || '',
          caracteristicas_producto: res.data.caracteristicas_producto || '',
          es_nuevo_producto: !!res.data.es_nuevo,
          tecnicos_requeridos: String(res.data.tecnicos_requeridos || 1),
        });
        setCaractLista(
          (res.data.caracteristicas_producto || '')
            .split('\n')
            .map((c) => c.replace(/^[-*\s]+/, '').trim())
            .filter(Boolean),
        );
        setColorLista(
          (res.data.colores_producto || '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
        );
      }
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const notify = (msg: string, tipo: 'ok' | 'err' = 'ok') => {
    setToast({ msg, tipo });
    window.setTimeout(() => setToast(null), 3200);
  };

  const setCampo = (campo: keyof EstadoForm, valor: string) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const crearProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoProveedor.nombre_proveedor.trim()) {
      notify(t('adm.productoDetalle.notifyNombreProveedorObligatorio'), 'err');
      return;
    }
    setGuardandoProveedor(true);
    try {
      const res = await api.post('/productos/proveedores', {
        nombre_proveedor: nuevoProveedor.nombre_proveedor.trim(),
        contacto_proveedor: nuevoProveedor.contacto_proveedor.trim() || null,
        telefono_proveedor: nuevoProveedor.telefono_proveedor.trim() || null,
        correo_proveedor: nuevoProveedor.correo_proveedor.trim() || null,
        direccion_proveedor: nuevoProveedor.direccion_proveedor.trim() || null,
      });
      const [cats, prov] = await Promise.all([
        api.get<CategoriaAdmin[]>('/productos/categorias'),
        api.get<ProveedorAdmin[]>('/productos/proveedores'),
      ]);
      setCategorias(cats.data || []);
      setProveedores(prov.data || []);
      setForm((prev) => ({ ...prev, id_proveedor_pr: String(res.data.id_proveedor) }));
      setMostrarNuevoProveedor(false);
      setNuevoProveedor({
        nombre_proveedor: '',
        contacto_proveedor: '',
        telefono_proveedor: '',
        correo_proveedor: '',
        direccion_proveedor: '',
      });
      notify(t('adm.productoDetalle.notifyProveedorCreado'));
    } catch (err: any) {
      notify(err.response?.data?.detail || t('adm.productoDetalle.notifyProveedorError'), 'err');
    } finally {
      setGuardandoProveedor(false);
    }
  };

  const colores = colorLista.map((c) => c.trim()).filter(Boolean);

  const validar = () => {
    if (!form.nombre_producto.trim()) return t('adm.productoDetalle.errorNombreProducto');
    const precio = parseFloat(form.precio_venta_producto);
    if (!precio || precio <= 0) return t('adm.productoDetalle.errorPrecioVenta');
    const stock = parseInt(form.stock_producto, 10);
    if (Number.isNaN(stock) || stock < 0) return t('adm.productoDetalle.errorStock');
    return null;
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalido = validar();
    if (invalido) {
      notify(invalido, 'err');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre_producto: form.nombre_producto.trim(),
        marca: form.marca?.trim() || null,
        referencia_producto: form.referencia_producto.trim() || null,
        precio_venta_producto: parseFloat(form.precio_venta_producto),
        precio_compra_producto: form.precio_compra_producto ? parseFloat(form.precio_compra_producto) : null,
        id_cate_pr: form.id_cate_pr ? parseInt(form.id_cate_pr, 10) : null,
        id_proveedor_pr: form.id_proveedor_pr ? parseInt(form.id_proveedor_pr, 10) : null,
        imagen_url: form.imagen_url.trim() || null,
        colores_producto: colorLista.map((c) => c.trim()).filter(Boolean).join(', ') || null,
        stock_producto: parseInt(form.stock_producto, 10),
        estado_producto: form.estado_producto,
        descuento_activo: form.descuento_activo.trim() === '' ? null : parseFloat(form.descuento_activo),
        promocion_hasta: form.promocion_hasta || null,
        descripcion_producto: form.descripcion_producto.trim() || null,
        caracteristicas_producto:
          caractLista.map((c) => c.trim()).filter(Boolean).join('\n') || null,
        es_nuevo_producto: form.es_nuevo_producto,
        tecnicos_requeridos: Math.max(1, parseInt(form.tecnicos_requeridos, 10) || 1),
      };
      if (esNuevo) {
        const res = await api.post<{ id_producto: number }>('/productos', payload);
        notify(t('adm.productoDetalle.notifyProductoCreado'));
        window.dispatchEvent(new CustomEvent('admin-producto-updated'));
        navigate(`/admin/productos/${res.data.id_producto}`, { replace: true });
        return;
      } else {
        await api.put(`/productos/${id}`, payload);
        notify(t('adm.productoDetalle.notifyProductoActualizado'));
      }
      window.dispatchEvent(new CustomEvent('admin-producto-updated'));
      setEditar(false);
      await cargar();
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.productoDetalle.notifyGuardarError'), 'err');
    } finally {
      setGuardando(false);
    }
  };

  const setVariante = (i: number, campo: keyof VarianteForm, valor: string) =>
    setVariantesForm((prev) => prev.map((v, j) => (j === i ? { ...v, [campo]: valor } : v)));

  const agregarVariante = () => setVariantesForm((prev) => [...prev, VARIANTE_VACIA()]);

  const quitarVariante = async (i: number, v: VarianteForm) => {
    if (v.id && !esNuevo) {
      setGuardando(true);
      try {
        await api.delete(`/productos/${id}/variantes/${v.id}`);
        notify(t('adm.productoDetalle.notifyVarianteEliminada'));
      } catch (err: any) {
        const msg = err.response?.data?.detail;
        notify(typeof msg === 'string' ? msg : t('adm.productoDetalle.notifyVarianteErrorEliminar'), 'err');
        setGuardando(false);
        return;
      } finally {
        setGuardando(false);
      }
    }
    setVariantesForm((prev) => prev.filter((_, j) => j !== i));
  };

  const guardarVariante = async (v: VarianteForm) => {
    if (!v.nombre.trim()) {
      notify(t('adm.productoDetalle.errorNombreVariante'), 'err');
      return;
    }
    const stock = parseInt(v.stock, 10);
    if (Number.isNaN(stock) || stock < 0) {
      notify(t('adm.productoDetalle.errorStockVariante'), 'err');
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        nombre: v.nombre.trim(),
        hex: v.hex.trim() || null,
        imagen_url: v.imagen_url.trim() || null,
        stock,
      };
      if (v.id) {
        const res = await api.put<VarianteAdmin>(`/productos/${id}/variantes/${v.id}`, payload);
        setVariantesForm((prev) =>
          prev.map((x) =>
            x.id === res.data.id
              ? { ...x, id: res.data.id, nombre: res.data.nombre, hex: res.data.hex || '', imagen_url: res.data.imagen_url || '', stock: String(res.data.stock) }
              : x,
          ),
        );
        notify(t('adm.productoDetalle.notifyVarianteActualizada'));
      } else {
        const res = await api.post<VarianteAdmin>(`/productos/${id}/variantes`, payload);
        setVariantesForm((prev) =>
          prev.map((x) =>
            x.id === null && x.nombre === payload.nombre
              ? { ...x, id: res.data.id }
              : x,
          ),
        );
        notify(t('adm.productoDetalle.notifyVarianteCreada'));
      }
      window.dispatchEvent(new CustomEvent('admin-producto-updated'));
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.productoDetalle.notifyVarianteGuardarError'), 'err');
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    setGuardando(true);
    try {
      const res = await api.delete(`/productos/${id}`);
      window.dispatchEvent(new CustomEvent('admin-producto-updated'));
      notify(res.data?.msg || t('adm.productoDetalle.notifyProductoEliminado'));
      window.setTimeout(() => navigate('/admin/productos', { replace: true }), 600);
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      notify(typeof msg === 'string' ? msg : t('adm.productoDetalle.notifyEliminarError'), 'err');
      setConfirmarBorrar(false);
    } finally {
      setGuardando(false);
    }
  };

  const formatoPrecio = (valor: number) => `$${valor.toLocaleString('es-CO')}`;

  return (
    <motion.section
      className="admin-panel"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link to="/admin/productos" className="ap-back-link">
        <FaArrowLeft /> {t('adm.productoDetalle.volver')}
      </Link>

      <div className="ap-header">
        <div>
          <h1 className="ap-title">{esNuevo ? t('adm.productoDetalle.tituloNuevo') : producto?.nombre_producto || t('adm.productoDetalle.tituloProducto')}</h1>
          <p className="ap-subtitle">
            {esNuevo
              ? t('adm.productoDetalle.subtituloNuevo')
              : t('adm.productoDetalle.subtituloEditar')}
          </p>
        </div>
        {!esNuevo && !editar && producto && (
          <div className="ap-header-actions">
            <button type="button" className="ap-btn ap-btn-primary" onClick={() => setEditar(true)}>
              <FaPen /> {t('adm.productoDetalle.editarProducto')}
            </button>
            <button type="button" className="ap-btn ap-btn-danger" onClick={() => setConfirmarBorrar(true)}>
              <FaTrash /> {t('adm.productoDetalle.eliminar')}
            </button>
          </div>
        )}
      </div>

      {cargando ? (
        <div className="ap-card">
          <div className="ap-states">
            <span className="ap-loader" />
            <h3>{t('adm.productoDetalle.cargandoTitulo')}</h3>
            <p>{t('adm.productoDetalle.cargandoTexto')}</p>
          </div>
        </div>
      ) : error ? (
        <div className="ap-card">
          <div className="ap-states error">
            <div className="ap-states-icon">
              <FaCircleInfo />
            </div>
            <h3>{t('adm.productoDetalle.errorTitulo')}</h3>
            <p>{t('adm.productoDetalle.errorTexto')}</p>
            <button type="button" className="ap-btn ap-btn-ghost" onClick={cargar}>
              {t('adm.productoDetalle.reintentar')}
            </button>
          </div>
        </div>
      ) : editar ? (
        <form onSubmit={guardar} className="ap-card">
          <div className="ap-card-head">
            <h2>{esNuevo ? <><FaCirclePlus /> {t('adm.productoDetalle.tituloNuevo')}</> : <><FaPen /> {t('adm.productoDetalle.editandoProducto')}</>}</h2>
          </div>

          <div className="ap-form-grid">
            <div className="ap-form-group full">
              <label className="ap-form-label" htmlFor="apf-nombre">{t('adm.productoDetalle.labelNombre')}</label>
              <input
                id="apf-nombre"
                className="ap-form-input"
                type="text"
                value={form.nombre_producto}
                onChange={(e) => setCampo('nombre_producto', e.target.value)}
                placeholder={t('adm.productoDetalle.phNombre')}
              />
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-marca">{t('adm.productoDetalle.labelMarca')}</label>
              <input
                id="apf-marca"
                className="ap-form-input"
                type="text"
                value={form.marca}
                onChange={(e) => setCampo('marca', e.target.value)}
                placeholder={t('adm.productoDetalle.phMarca')}
              />
              <span className="ap-form-hint">{t('adm.productoDetalle.hintMarca')}</span>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-ref">{t('adm.productoDetalle.labelReferencia')}</label>
              <input
                id="apf-ref"
                className="ap-form-input"
                type="text"
                value={form.referencia_producto}
                onChange={(e) => setCampo('referencia_producto', e.target.value)}
                placeholder={t('adm.productoDetalle.phReferencia')}
              />
              <span className="ap-form-hint">{t('adm.productoDetalle.hintReferencia')}</span>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-cat">{t('adm.productoDetalle.labelCategoria')}</label>
              <select
                id="apf-cat"
                className="ap-form-select"
                value={form.id_cate_pr}
                onChange={(e) => setCampo('id_cate_pr', e.target.value)}
              >
                <option value="">{t('adm.productoDetalle.sinCategoria')}</option>
                {categorias.map((c) => (
                  <option key={c.id_categoria} value={c.id_categoria}>
                    {c.nombre_categoria}
                  </option>
                ))}
              </select>
              {esNuevo && categoriaInicial && (
                <span className="ap-form-hint">
                  {t('adm.productoDetalle.hintCategoriaPresel')}
                </span>
              )}
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-prov">{t('adm.productoDetalle.labelProveedor')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  id="apf-prov"
                  className="ap-form-select"
                  value={form.id_proveedor_pr}
                  onChange={(e) => setCampo('id_proveedor_pr', e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">{t('adm.productoDetalle.sinProveedor')}</option>
                  {proveedores.map((p) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>
                      {p.nombre_proveedor}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost"
                  onClick={() => setMostrarNuevoProveedor(true)}
                  title={t('adm.productoDetalle.agregarProveedorTitle')}
                  aria-label={t('adm.productoDetalle.agregarProveedorAria')}
                >
                  <FaCirclePlus />
                </button>
              </div>
              <span className="ap-form-hint">{t('adm.productoDetalle.hintProveedor')}</span>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-pv">{t('adm.productoDetalle.labelPrecioVenta')}</label>
              <input
                id="apf-pv"
                className="ap-form-input"
                type="number"
                min="0"
                step="0.01"
                value={form.precio_venta_producto}
                onChange={(e) => setCampo('precio_venta_producto', e.target.value)}
                placeholder="70000"
              />
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-pc">{t('adm.productoDetalle.labelPrecioCompra')}</label>
              <input
                id="apf-pc"
                className="ap-form-input"
                type="number"
                min="0"
                step="0.01"
                value={form.precio_compra_producto}
                onChange={(e) => setCampo('precio_compra_producto', e.target.value)}
                placeholder="45000"
              />
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-stock">{t('adm.productoDetalle.labelStock')}</label>
              <input
                    id="apf-stock"
                    className="ap-form-input"
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock_producto}
                    onChange={(e) => setCampo('stock_producto', e.target.value)}
                  />
                  <span className="ap-form-hint">
                    {t('adm.productoDetalle.hintStockBajo', { minimo: STOCK_MINIMO })}
                  </span>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-estado">{t('adm.productoDetalle.labelEstado')}</label>
              <select
                id="apf-estado"
                className="ap-form-select"
                value={form.estado_producto}
                onChange={(e) => setCampo('estado_producto', e.target.value)}
              >
                <option value="activo">{t('adm.productoDetalle.estadoActivo')}</option>
                <option value="inactivo">{t('adm.productoDetalle.estadoInactivo')}</option>
              </select>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-tecnicos">{t('adm.productoDetalle.labelTecnicos')}</label>
              <input
                id="apf-tecnicos"
                className="ap-form-input"
                type="number"
                min="1"
                step="1"
                value={form.tecnicos_requeridos}
                onChange={(e) => setCampo('tecnicos_requeridos', e.target.value)}
              />
              <span className="ap-form-hint">{t('adm.productoDetalle.hintTecnicos')}</span>
            </div>

            <div className="ap-form-group">
              <div className="ap-nuevo-head">
                <label className="ap-form-label" htmlFor="apf-nuevo">
                  {t('adm.productoDetalle.labelNuevo')}
                </label>
                <span className={`ap-nuevo-sino ${form.es_nuevo_producto ? 'on' : ''}`}>
                  {form.es_nuevo_producto ? t('adm.productoDetalle.si') : t('adm.productoDetalle.no')}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                id="apf-nuevo"
                aria-checked={form.es_nuevo_producto}
                className={`ap-nuevo-switch ${form.es_nuevo_producto ? 'on' : ''}`}
                onClick={() =>
                  setForm((prev) => ({ ...prev, es_nuevo_producto: !prev.es_nuevo_producto }))
                }
              >
                <span className="ap-nuevo-thumb" />
              </button>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-dcto">{t('adm.productoDetalle.labelDescuento')}</label>
              <input
                id="apf-dcto"
                className="ap-form-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.descuento_activo}
                onChange={(e) => setCampo('descuento_activo', e.target.value)}
                placeholder="0"
              />
              <span className="ap-form-hint">{t('adm.productoDetalle.hintDescuento')}</span>
            </div>

            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="apf-dcto-fin">{t('adm.productoDetalle.labelPromoFin')}</label>
              <input
                id="apf-dcto-fin"
                className="ap-form-input"
                type="date"
                value={form.promocion_hasta}
                onChange={(e) => setCampo('promocion_hasta', e.target.value)}
              />
              <span className="ap-form-hint">{t('adm.productoDetalle.hintPromoFin')}</span>
            </div>

            <div className="ap-form-group full">
              <label className="ap-form-label" htmlFor="apf-img">{t('adm.productoDetalle.labelImagen')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="apf-img"
                  className="ap-form-input"
                  type="url"
                  value={form.imagen_url}
                  onChange={(e) => setCampo('imagen_url', e.target.value)}
                  placeholder={t('adm.productoDetalle.phImagenUrl')}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={subiendoImg}
                  title={t('adm.productoDetalle.subirTitle')}
                >
                  <FaUpload /> {subiendoImg ? t('adm.productoDetalle.subiendo') : t('adm.productoDetalle.subir')}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={subirImagen}
                />
              </div>
              <span className="ap-form-hint">{t('adm.productoDetalle.hintImagen')}</span>
              {(form.imagen_url || !esNuevo) && (
                <img
                  src={form.imagen_url || `/productos/${id}.jpg`}
                  alt={t('adm.productoDetalle.altVistaPrevia')}
                  className="ap-thumb"
                  style={{ width: 80, height: 80, marginTop: 8, background: '#222' }}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (img.src.includes('default.png')) {
                      img.style.display = 'none';
                    } else {
                      img.src = '/productos/default.png';
                    }
                  }}
                />
              )}
            </div>

            <div className="ap-form-group full">
              <label className="ap-form-label" htmlFor="apf-colores">{t('adm.productoDetalle.labelColores')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colorLista.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      maxWidth: 520,
                    }}
                  >
                    <input
                      className="ap-form-input"
                      type="text"
                      value={c}
                      onChange={(e) =>
                        setColorLista((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder={t('adm.productoDetalle.phColor', { n: i + 1 })}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => setColorLista((prev) => prev.filter((_, j) => j !== i))}
                      title={t('adm.productoDetalle.quitarColorTitle')}
                      aria-label={t('adm.productoDetalle.quitarColorAria')}
                      style={{
                        width: 34,
                        height: 34,
                        minWidth: 34,
                        borderRadius: 8,
                        border: '1px solid rgba(224,92,92,0.4)',
                        background: 'rgba(224,92,92,0.12)',
                        color: '#e05c5c',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      <FaXmark />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setColorLista((prev) => [...prev, ''])}
                >
                  <FaCirclePlus /> {t('adm.productoDetalle.agregarColor')}
                </button>
              </div>
              {colores.length > 0 && (
                <div className="ap-colores" style={{ marginTop: 8 }}>
                  {colores.map((color, i) => (
                    <span key={i} className="ap-cchip" style={{ ['--chip-color' as never]: color } as React.CSSProperties}>
                      {color}
                    </span>
                  ))}
                </div>
              )}
              <span className="ap-form-hint">
                {t('adm.productoDetalle.hintColores')}
              </span>
            </div>

            <div className="ap-form-group full">
              <label className="ap-form-label">{t('adm.productoDetalle.labelVariantes')}</label>
              <div className="ap-variantes">
                {variantesForm.length === 0 && (
                  <span className="ap-form-hint">
                    {t('adm.productoDetalle.hintSinVariantes')}
                  </span>
                )}
                {variantesForm.map((v, i) => (
                  <div className="ap-variante-row" key={i}>
                    <input
                      className="ap-form-input"
                      type="text"
                      placeholder={t('adm.productoDetalle.phVarianteColor')}
                      value={v.nombre}
                      onChange={(e) => setVariante(i, 'nombre', e.target.value)}
                    />
                    <input
                      className="ap-form-input"
                      type="color"
                      title={t('adm.productoDetalle.titleVarianteHex')}
                      value={/^#[0-9a-fA-F]{6}$/.test(v.hex) ? v.hex : '#d4a54b'}
                      onChange={(e) => setVariante(i, 'hex', e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="ap-form-input"
                        type="text"
                        placeholder={t('adm.productoDetalle.phVarianteUrl')}
                        value={v.imagen_url}
                        onChange={(e) => setVariante(i, 'imagen_url', e.target.value)}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        type="button"
                        className="ap-btn ap-btn-ghost"
                        disabled={subiendoImg}
                        title={t('adm.productoDetalle.subirTitle')}
                        onClick={() => varianteFileRefs.current[i]?.click()}
                      >
                        <FaUpload />
                      </button>
                      <input
                        ref={(el) => { varianteFileRefs.current[i] = el; }}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => subirImagenVariante(i, e)}
                      />
                    </div>
                    {v.imagen_url && (
                      <img
                        src={v.imagen_url}
                        alt={t('adm.productoDetalle.altVariante')}
                        className="ap-thumb"
                        style={{ width: 48, height: 48, background: '#222', objectFit: 'cover' }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <input
                      className="ap-form-input"
                      type="number"
                      min="0"
                      placeholder={t('adm.productoDetalle.phVarianteStock')}
                      value={v.stock}
                      onChange={(e) => setVariante(i, 'stock', e.target.value)}
                    />
                    <div className="ap-variante-acciones">
                      <button
                        type="button"
                        className="ap-btn ap-btn-ghost"
                        disabled={guardando || esNuevo}
                        title={esNuevo ? t('adm.productoDetalle.guardarVarianteTitle') : undefined}
                        onClick={() => guardarVariante(v)}
                      >
                        <FaFloppyDisk /> {t('adm.productoDetalle.guardarVariante')}
                      </button>
                      <button
                        type="button"
                        className="ap-btn ap-btn-danger"
                        disabled={guardando}
                        onClick={() => quitarVariante(i, v)}
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={agregarVariante}
                  disabled={esNuevo}
                >
                  <FaCirclePlus /> {t('adm.productoDetalle.agregarVariante')}
                </button>
              </div>
            </div>

            <div className="ap-form-group full">
              <label className="ap-form-label" htmlFor="apf-desc">{t('adm.productoDetalle.labelDescripcion')}</label>
              <textarea
                id="apf-desc"
                className="ap-form-textarea"
                value={form.descripcion_producto}
                onChange={(e) => setCampo('descripcion_producto', e.target.value)}
                placeholder={t('adm.productoDetalle.phDescripcion')}
              />
            </div>

            <div className="ap-form-group full">
              <label className="ap-form-label">{t('adm.productoDetalle.labelCaracteristicas')}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {caractLista.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      maxWidth: 520,
                    }}
                  >
                    <input
                      className="ap-form-input"
                      type="text"
                      value={c}
                      onChange={(e) =>
                        setCaractLista((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder={t('adm.productoDetalle.phCaracteristica', { n: i + 1 })}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => setCaractLista((prev) => prev.filter((_, j) => j !== i))}
                      title={t('adm.productoDetalle.quitarCaractTitle')}
                      aria-label={t('adm.productoDetalle.quitarCaractAria')}
                      style={{
                        width: 34,
                        height: 34,
                        minWidth: 34,
                        borderRadius: 8,
                        border: '1px solid rgba(224,92,92,0.4)',
                        background: 'rgba(224,92,92,0.12)',
                        color: '#e05c5c',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        flexShrink: 0,
                      }}
                    >
                      <FaXmark />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ap-btn ap-btn-ghost"
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => setCaractLista((prev) => [...prev, ''])}
                >
                  <FaCirclePlus /> {t('adm.productoDetalle.agregarCaracteristica')}
                </button>
              </div>
              <span className="ap-form-hint">
                {t('adm.productoDetalle.hintCaracteristicas')}
              </span>
            </div>
          </div>

          <div className="ap-form-row">
            <button
              type="button"
              className="ap-btn ap-btn-ghost"
              onClick={() => {
                setEditar(esNuevo);
                if (!esNuevo) navigate('/admin/productos', { replace: true });
              }}
              disabled={guardando}
            >
              <FaXmark /> {t('adm.productoDetalle.cancelar')}
            </button>
            <button type="submit" className="ap-btn ap-btn-primary" disabled={guardando}>
              <FaFloppyDisk /> {guardando ? t('adm.productoDetalle.guardando') : esNuevo ? t('adm.productoDetalle.crearProducto') : t('adm.productoDetalle.guardarCambios')}
            </button>
          </div>
        </form>
      ) : producto ? (
        <div className="ap-card">
          <div className="ap-prod-layout">
            <img
              src={producto.imagen_url || `/productos/${producto.id_producto}.jpg`}
              alt={producto.nombre_producto}
              className="ap-prod-img"
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.includes('default.png')) {
                  img.style.display = 'none';
                } else {
                  img.src = '/productos/default.png';
                }
              }}
            />

            <div className="ap-prod-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span className={`ap-badge ${producto.estado_producto === 'activo' ? 'ok' : 'err'}`}>
                  {producto.estado_producto === 'activo' ? t('adm.productoDetalle.estadoActivoTienda') : t('adm.productoDetalle.estadoInactivoBadge')}
                </span>
                {producto.nombre_categoria && <span className="ap-badge info">{producto.nombre_categoria}</span>}
                <span className={`ap-badge ${badgeStock(producto.stock_producto)}`}>
                  {textoStock(producto.stock_producto)}
                </span>
              </div>

              <span className="ap-prod-price">{formatoPrecio(producto.precio_venta_producto)}</span>

              {producto.descripcion_producto && <p className="ap-prod-desc">{producto.descripcion_producto}</p>}

              <div className="ap-def-list">
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.productoDetalle.defReferencia')}</div>
                  <div className="ap-def-value">{producto.referencia_producto || '—'}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">ID</div>
                  <div className="ap-def-value">#{producto.id_producto}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.productoDetalle.defProveedor')}</div>
                  <div className="ap-def-value">{producto.nombre_proveedor || '—'}</div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.productoDetalle.defPrecioCompra')}</div>
                  <div className="ap-def-value">
                    {producto.precio_compra_producto ? formatoPrecio(producto.precio_compra_producto) : '—'}
                  </div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.productoDetalle.defStock')}</div>
                  <div className="ap-def-value">
                    {t('adm.productoDetalle.unidades', { n: producto.stock_producto })}
                    {producto.stock_producto > 0 && producto.stock_producto < STOCK_MINIMO && (
                      <span className="ap-badge warn" style={{ marginLeft: 8 }}>
                        {t('adm.productoDetalle.stockBajo', { minimo: STOCK_MINIMO })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ap-def">
                  <div className="ap-def-label">{t('adm.productoDetalle.defRegistrado')}</div>
                  <div className="ap-def-value">
                    {producto.fecha_registro_producto
                      ? new Date(producto.fecha_registro_producto).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO')
                      : '—'}
                  </div>
                </div>
              </div>

              {colores.length > 0 && (
                <div>
                  <span className="ap-def-label">{t('adm.productoDetalle.coloresDisponibles')}</span>
                  <div className="ap-colores" style={{ marginTop: 8 }}>
                    {colores.map((color, i) => (
                      <span key={i} className="ap-cchip" style={{ ['--chip-color' as never]: color } as React.CSSProperties}>
                        {color}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {producto.variantes && producto.variantes.length > 0 && (
                <div>
                  <span className="ap-def-label">{t('adm.productoDetalle.variantes', { n: producto.variantes.length })}</span>
                  <div className="ap-colores" style={{ marginTop: 8 }}>
                    {producto.variantes.map((v) => (
                      <span
                        key={v.id}
                        className="ap-cchip"
                        style={{ ['--chip-color' as never]: v.hex || '#d4a54b' } as React.CSSProperties}
                      >
                        {t('adm.productoDetalle.varianteInfo', { nombre: v.nombre, stock: v.stock })}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {confirmarBorrar && (
        <div className="ap-modal-overlay">
          <div className="ap-modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <FaTriangleExclamation style={{ color: '#ff8f93', marginRight: 8 }} />
              {t('adm.productoDetalle.eliminarTitulo')}
            </h3>
            <p>
              <strong>{producto?.nombre_producto}</strong> {t('adm.productoDetalle.eliminarTexto')}
            </p>
            <div className="ap-modal-actions">
              <button type="button" className="ap-btn ap-btn-ghost" onClick={() => setConfirmarBorrar(false)} disabled={guardando}>
                {t('adm.productoDetalle.cancelar')}
              </button>
              <button type="button" className="ap-btn ap-btn-danger" onClick={eliminar} disabled={guardando}>
                <FaTrash /> {guardando ? t('adm.productoDetalle.eliminando') : t('adm.productoDetalle.siEliminar')}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarNuevoProveedor && (
        <div className="ap-modal-overlay">
          <form className="ap-modal" onSubmit={crearProveedor} onClick={(e) => e.stopPropagation()}>
            <h3>
              <FaCirclePlus style={{ color: '#ffd98a', marginRight: 8 }} />
              {t('adm.productoDetalle.nuevoProveedor')}
            </h3>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="np-nombre">{t('adm.productoDetalle.npNombre')}</label>
              <input
                id="np-nombre"
                className="ap-form-input"
                type="text"
                value={nuevoProveedor.nombre_proveedor}
                onChange={(e) => setNuevoProveedor((prev) => ({ ...prev, nombre_proveedor: e.target.value }))}
                placeholder={t('adm.productoDetalle.phNombreProv')}
              />
            </div>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="np-contacto">{t('adm.productoDetalle.npContacto')}</label>
              <input
                id="np-contacto"
                className="ap-form-input"
                type="text"
                value={nuevoProveedor.contacto_proveedor}
                onChange={(e) => setNuevoProveedor((prev) => ({ ...prev, contacto_proveedor: e.target.value }))}
                placeholder={t('adm.productoDetalle.phContacto')}
              />
            </div>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="np-tel">{t('adm.productoDetalle.npTelefono')}</label>
              <input
                id="np-tel"
                className="ap-form-input"
                type="text"
                value={nuevoProveedor.telefono_proveedor}
                onChange={(e) => setNuevoProveedor((prev) => ({ ...prev, telefono_proveedor: e.target.value }))}
                placeholder="+57 300 000 0000"
              />
            </div>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="np-correo">{t('adm.productoDetalle.npCorreo')}</label>
              <input
                id="np-correo"
                className="ap-form-input"
                type="email"
                value={nuevoProveedor.correo_proveedor}
                onChange={(e) => setNuevoProveedor((prev) => ({ ...prev, correo_proveedor: e.target.value }))}
                placeholder={t('adm.productoDetalle.phCorreo')}
              />
            </div>
            <div className="ap-form-group">
              <label className="ap-form-label" htmlFor="np-dir">{t('adm.productoDetalle.npDireccion')}</label>
              <input
                id="np-dir"
                className="ap-form-input"
                type="text"
                value={nuevoProveedor.direccion_proveedor}
                onChange={(e) => setNuevoProveedor((prev) => ({ ...prev, direccion_proveedor: e.target.value }))}
                placeholder={t('adm.productoDetalle.phDireccion')}
              />
            </div>
            <div className="ap-modal-actions">
              <button type="button" className="ap-btn ap-btn-ghost" onClick={() => setMostrarNuevoProveedor(false)} disabled={guardandoProveedor}>
                <FaXmark /> {t('adm.productoDetalle.cancelar')}
              </button>
              <button type="submit" className="ap-btn ap-btn-primary" disabled={guardandoProveedor}>
                <FaCirclePlus /> {guardandoProveedor ? t('adm.productoDetalle.guardandoProveedor') : t('adm.productoDetalle.agregarProveedorBtn')}
              </button>
            </div>
          </form>
        </div>
      )}

      {toast && (
        <div className={`ap-toast ${toast.tipo}`}>
          {toast.tipo === 'ok' ? <FaCircleInfo /> : <FaTriangleExclamation />}
          {toast.msg}
        </div>
      )}
    </motion.section>
  );
};

export default AdminProductoDetalle;