import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BarraNav, FaixaOffline } from './components/ui'
import { ProvedorEstado, useEstado } from './estado'
import { useSincronizarPush } from './components/Avisos'
import { MODO_DEMO } from './data/api'
import { Abertura, Entrar, Inicio } from './pages/cliente/Inicio'
import { Confirmacao, DadosCliente, EscolherHorario, EscolherServico } from './pages/cliente/Agendar'
import { DetalheCliente, Historico, MinhaAgenda, Perfil } from './pages/cliente/Conta'
import { LayoutTecnico, LoginTecnico } from './pages/tecnico/comum'
import { AgendaTecnico } from './pages/tecnico/Agenda'
import { ConcluirServico, DetalheAgendamentoTec } from './pages/tecnico/Agendamento'
import { ClientesTecnico, DetalheClienteTec } from './pages/tecnico/Clientes'
import { AjustesTecnico, ServicosTecnico } from './pages/tecnico/Ajustes'

function LayoutCliente() {
  const { perfil } = useEstado()
  useSincronizarPush('cliente', !!perfil)
  const avisos = perfil?.agendamentos.filter((a) => a.status === 'remarcado').length ?? 0
  return (
    <>
      <Outlet />
      <BarraNav
        itens={[
          { para: '/inicio', rotulo: 'Início', icone: 'inicio' },
          { para: '/agenda', rotulo: 'Agenda', icone: 'agenda', contador: avisos },
          { para: '/historico', rotulo: 'Histórico', icone: 'historico' },
          { para: '/perfil', rotulo: 'Perfil', icone: 'perfil' },
        ]}
      />
    </>
  )
}

export function App() {
  return (
    <HashRouter>
      {MODO_DEMO && <div className="faixa-demo">Modo demonstração · dados salvos só neste aparelho</div>}
      <FaixaOffline />
      <ProvedorEstado>
        <Routes>
          <Route path="/" element={<Abertura />} />
          <Route path="/entrar" element={<Entrar />} />
          <Route element={<LayoutCliente />}>
            <Route path="/inicio" element={<Inicio />} />
            <Route path="/agenda" element={<MinhaAgenda />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/perfil" element={<Perfil />} />
          </Route>
          <Route path="/agendar" element={<EscolherServico />} />
          <Route path="/agendar/horario" element={<EscolherHorario />} />
          <Route path="/agendar/dados" element={<DadosCliente />} />
          <Route path="/agendar/feito/:id" element={<Confirmacao />} />
          <Route path="/meus/:id" element={<DetalheCliente />} />

          <Route path="/tecnico/login" element={<LoginTecnico />} />
          <Route path="/tecnico" element={<LayoutTecnico />}>
            <Route index element={<AgendaTecnico />} />
            <Route path="agendamento/:id" element={<DetalheAgendamentoTec />} />
            <Route path="agendamento/:id/concluir" element={<ConcluirServico />} />
            <Route path="clientes" element={<ClientesTecnico />} />
            <Route path="clientes/:id" element={<DetalheClienteTec />} />
            <Route path="servicos" element={<ServicosTecnico />} />
            <Route path="ajustes" element={<AjustesTecnico />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ProvedorEstado>
    </HashRouter>
  )
}
