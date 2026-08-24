// Ruta Citas — protegida: SOLO cliente autenticado (GateCliente).
// Un visitante que llegue por deep-link ve el flujo de acceso, no la pantalla.
import GateCliente from "@/components/app/GateCliente";
import PantallaCitas from "@/components/public/PantallaCitas";

export default function CitasRoute() {
  return (
    <GateCliente titulo="Citas">
      <PantallaCitas />
    </GateCliente>
  );
}
