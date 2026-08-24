// Ruta Técnicos — protegida: SOLO cliente autenticado (GateCliente).
// Un visitante que llegue por deep-link ve el flujo de acceso, no la pantalla.
import GateCliente from "@/components/app/GateCliente";
import PantallaTecnicos from "@/components/public/PantallaTecnicos";

export default function TecnicosRoute() {
  return (
    <GateCliente titulo="Técnicos">
      <PantallaTecnicos />
    </GateCliente>
  );
}
