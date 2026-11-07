import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icone, iconeServico } from '../../components/Icone'
import { BotaoInstalar } from '../../components/Instalar'
import { AtivarAvisos } from '../../components/Avisos'
import { Cabecalho, Carregando, Erro, Modal, RodapeVersao, useAcao } from '../../components/ui'
import { useEstado } from '../../estado'
import type { Ajustes, Bloqueio, Disponibilidade, Servico } from '../../data/types'
import { formatarWhats, mascaraWhats, moeda } from '../../lib/formato'
import { DIAS_LONGOS, chaveDia, dataCurta, horaDe, hojeChave, paraMinutos, somarDias } from '../../lib/tempo'

// ---------------- Serviços ----------------
export function ServicosTecnico() {
  const { api, recarregarConfig, toast } = useEstado()
  const [lista, setLista] = useState<Servico[] | null>(null)
  const [editar, setEditar] = useState<Servico | null>(null)

  const carregar = useCallback(async () => setLista(await api.tecServicos()), [api])
  useEffect(() => {
    carregar()
  }, [carregar])

  return (
    <main className="tela larga">
      <Cabecalho titulo="Serviços" />
      <p className="mutado">Duração e retorno usados para calcular os horários livres e os lembretes.</p>
      {!lista ? (
        <Carregando />
      ) : (
        <div className="grade-desk coluna">
          {lista.map((s) => (
            <button key={s.id} className="cartao clicavel p linha" onClick={() => setEditar(s)} style={{ opacity: s.ativo ? 1 : 0.55 }}>
              <span className="icone-bola">
                <Icone nome={iconeServico(s.id)} />
              </span>
              <span className="cresce coluna p">
                <strong>{s.nome}{!s.ativo && ' (oculto)'}</strong>
                <span className="mutado peq">
                  {s.duracao_min} min (+{s.duracao_adicional_min ?? s.duracao_min} por aparelho a mais) · {s.intervalo_retorno_meses ? `retorno em ${s.intervalo_retorno_meses} meses` : 'sem retorno'} ·{' '}
                  {s.preco_base != null ? moeda(s.preco_base) : 'sob orçamento'}
                </span>
              </span>
              <Icone nome="editar" />
            </button>
          ))}
        </div>
      )}
      {editar && (
        <EditarServico
          s={editar}
          fechar={() => setEditar(null)}
          salvar={async (n) => {
            await api.tecSalvarServico(n)
            await recarregarConfig()
            setLista((l) => (l ?? []).map((x) => (x.id === n.id ? n : x)))
            setEditar(null)
            toast('Serviço salvo.')
          }}
        />
      )}
    </main>
  )
}

function EditarServico({ s, fechar, salvar }: { s: Servico; fechar: () => void; salvar: (s: Servico) => Promise<void> }) {
  const [f, setF] = useState({
    nome: s.nome,
    descricao: s.descricao,
    duracao: String(s.duracao_min),
    adicional: String(s.duracao_adicional_min ?? s.duracao_min),
    grande: String(s.extra_grande_min ?? 0),
    retorno: s.intervalo_retorno_meses ? String(s.intervalo_retorno_meses) : '',
    preco: s.preco_base != null ? String(s.preco_base).replace('.', ',') : '',
    ativo: s.ativo,
  })
  const { ocupado, erro, rodar } = useAcao()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <Modal titulo={s.nome} aberto fechar={fechar}>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            const duracao = Number(f.duracao)
            if (!duracao || duracao < 15 || duracao > 720) throw new Error('Duração entre 15 e 720 minutos.')
            const adicional = Number(f.adicional || 0)
            if (isNaN(adicional) || adicional < 0 || adicional > 720) throw new Error('Tempo por aparelho a mais entre 0 e 720 minutos.')
            const grande = Number(f.grande || 0)
            if (isNaN(grande) || grande < 0 || grande > 240) throw new Error('Tempo extra para aparelho grande entre 0 e 240 minutos.')
            const retorno = f.retorno ? Number(f.retorno) : null
            if (retorno != null && (retorno < 1 || retorno > 60)) throw new Error('Retorno entre 1 e 60 meses.')
            const preco = f.preco.trim() ? Number(f.preco.replace(/\./g, '').replace(',', '.')) : null
            if (preco != null && isNaN(preco)) throw new Error('Preço inválido.')
            await salvar({ ...s, nome: f.nome.trim(), descricao: f.descricao.trim(), duracao_min: duracao, duracao_adicional_min: adicional, extra_grande_min: grande, intervalo_retorno_meses: retorno, preco_base: preco, ativo: f.ativo })
          })
        }}
      >
        <div className="campo">
          <label htmlFor="sn">Nome</label>
          <input id="sn" className="entrada" value={f.nome} onChange={set('nome')} required />
        </div>
        <div className="campo">
          <label htmlFor="sd">Descrição curta</label>
          <input id="sd" className="entrada" value={f.descricao} onChange={set('descricao')} />
        </div>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="sdu">Duração de 1 aparelho (min)</label>
            <input id="sdu" className="entrada" inputMode="numeric" value={f.duracao} onChange={set('duracao')} required />
          </div>
          <div className="campo">
            <label htmlFor="sr">Retorno (meses)</label>
            <input id="sr" className="entrada" inputMode="numeric" placeholder="Sem retorno" value={f.retorno} onChange={set('retorno')} />
          </div>
        </div>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="sad">Cada aparelho a mais (min)</label>
            <input id="sad" className="entrada" inputMode="numeric" value={f.adicional} onChange={set('adicional')} />
          </div>
          <div className="campo">
            <label htmlFor="sgr">Extra p/ 18 mil BTUs ou mais (min)</label>
            <input id="sgr" className="entrada" inputMode="numeric" value={f.grande} onChange={set('grande')} />
          </div>
        </div>
        <p className="mutado peq">
          Exemplo: 3 aparelhos = {Number(f.duracao || 0) + 2 * Number(f.adicional || 0)} min
          {Number(f.grande || 0) > 0 ? ` (ou ${3 * Number(f.grande)} min a mais se forem grandes)` : ''}.
        </p>
        <div className="campo">
          <label htmlFor="sp">Preço base (R$)</label>
          <input id="sp" className="entrada" inputMode="decimal" placeholder="Vazio = sob orçamento" value={f.preco} onChange={set('preco')} />
        </div>
        <label className="linha" style={{ minHeight: 44 }}>
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} style={{ width: 22, height: 22 }} />
          Aparece para o cliente
        </label>
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          Salvar
        </button>
      </form>
    </Modal>
  )
}

// ---------------- Ajustes ----------------
export function AjustesTecnico() {
  const { api, config, recarregarConfig, toast } = useEstado()
  const nav = useNavigate()
  const [a, setA] = useState<Ajustes>({ ...config.ajustes, whatsapp_tecnico: formatarWhats(config.ajustes.whatsapp_tecnico) })
  const [disp, setDisp] = useState<Disponibilidade[]>(config.disponibilidade)
  const [bloqueios, setBloqueios] = useState<Bloqueio[] | null>(null)
  const [novoBloqueio, setNovoBloqueio] = useState(false)
  const [reiniciar, setReiniciar] = useState(false)
  const [permissao, setPermissao] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const geral = useAcao()
  const horas = useAcao()

  const carregarBloqueios = useCallback(() => api.tecBloqueios().then(setBloqueios), [api])
  useEffect(() => {
    carregarBloqueios().catch(() => setBloqueios([]))
  }, [carregarBloqueios])

  const num = (k: keyof Ajustes) => (e: React.ChangeEvent<HTMLInputElement>) => setA({ ...a, [k]: Number(e.target.value.replace(/\D/g, '')) || 0 })

  function faixas(dia: number) {
    return disp.map((d, i) => ({ ...d, i })).filter((d) => d.dia_semana === dia)
  }
  function mudarFaixa(i: number, campo: 'hora_inicio' | 'hora_fim', v: string) {
    setDisp(disp.map((d, j) => (j === i ? { ...d, [campo]: v } : d)))
  }

  return (
    <main className="tela larga">
      <Cabecalho titulo="Ajustes" />
      <div className="grade-desk coluna">
        <div className="coluna">
          <section className="cartao coluna" aria-label="Contato e regras">
            <h2 className="subtitulo">Contato e regras</h2>
            <div className="campo">
              <label htmlFor="an">Seu nome (aparece para o cliente)</label>
              <input id="an" className="entrada" value={a.nome_tecnico} onChange={(e) => setA({ ...a, nome_tecnico: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="aw">Seu WhatsApp</label>
              <input id="aw" className="entrada" inputMode="tel" value={a.whatsapp_tecnico} onChange={(e) => setA({ ...a, whatsapp_tecnico: mascaraWhats(e.target.value) })} />
            </div>
            <div className="grade-2">
              <div className="campo">
                <label htmlFor="ad">Deslocamento entre atendimentos (min)</label>
                <input id="ad" className="entrada" inputMode="numeric" value={a.intervalo_deslocamento_min} onChange={num('intervalo_deslocamento_min')} />
              </div>
              <div className="campo">
                <label htmlFor="aa">Antecedência mínima (horas)</label>
                <input id="aa" className="entrada" inputMode="numeric" value={a.antecedencia_minima_horas} onChange={num('antecedencia_minima_horas')} />
              </div>
              <div className="campo">
                <label htmlFor="af">Agendar até quantos dias à frente</label>
                <input id="af" className="entrada" inputMode="numeric" value={a.dias_a_frente} onChange={num('dias_a_frente')} />
              </div>
              <div className="campo">
                <label htmlFor="ap">Intervalo entre horários (min)</label>
                <select id="ap" className="entrada" value={a.passo_min} onChange={(e) => setA({ ...a, passo_min: Number(e.target.value) })}>
                  {[30, 60, 90, 120].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <Erro>{geral.erro}</Erro>
            <button
              className="btn btn-primario"
              disabled={geral.ocupado}
              onClick={() =>
                geral.rodar(async () => {
                  if (a.whatsapp_tecnico.replace(/\D/g, '').length < 10) throw new Error('Informe seu WhatsApp com DDD.')
                  if (a.dias_a_frente < 1) throw new Error('Dias à frente deve ser pelo menos 1.')
                  await api.tecSalvarAjustes(a)
                  await recarregarConfig()
                  toast('Ajustes salvos.')
                })
              }
            >
              Salvar
            </button>
          </section>

          <section className="cartao coluna" aria-label="Bloqueio de datas">
            <div className="linha entre">
              <h2 className="subtitulo">Bloqueio de datas</h2>
              <button className="btn btn-claro btn-p" onClick={() => setNovoBloqueio(true)}>
                <Icone nome="mais" tamanho={18} /> Bloquear
              </button>
            </div>
            <p className="mutado peq">Folgas, feriados ou compromissos. Os clientes não verão esses horários.</p>
            {!bloqueios ? (
              <Carregando />
            ) : bloqueios.filter((b) => b.fim >= new Date().toISOString()).length === 0 ? (
              <p className="mutado">Nenhum bloqueio.</p>
            ) : (
              bloqueios
                .filter((b) => new Date(b.fim).getTime() >= Date.now())
                .map((b) => (
                  <div key={b.id} className="linha cartao p">
                    <div className="cresce coluna p">
                      <strong>{textoBloqueio(b)}</strong>
                      {b.motivo && <span className="mutado peq">{b.motivo}</span>}
                    </div>
                    <button
                      className="btn-icone"
                      aria-label={`Remover bloqueio ${textoBloqueio(b)}`}
                      onClick={async () => {
                        await api.tecRemoverBloqueio(b.id)
                        carregarBloqueios()
                      }}
                    >
                      <Icone nome="lixo" />
                    </button>
                  </div>
                ))
            )}
          </section>
        </div>

        <div className="coluna">
          <section className="cartao coluna" aria-label="Dias e horários de trabalho">
            <h2 className="subtitulo">Dias e horários de trabalho</h2>
            <div className="tabela-horas">
              {[1, 2, 3, 4, 5, 6, 0].map((dia) => (
                <div key={dia} className="linha-dia">
                  <div className="linha entre">
                    <span className="forte">{DIAS_LONGOS[dia]}</span>
                    {faixas(dia).length === 0 && <span className="chip neutro">Folga</span>}
                  </div>
                  {faixas(dia).map((f) => (
                    <div key={f.i} className="faixa-hora">
                      <select className="entrada" aria-label={`${DIAS_LONGOS[dia]} início`} value={f.hora_inicio} onChange={(e) => mudarFaixa(f.i, 'hora_inicio', e.target.value)}>
                        {opcoesHora(f.hora_inicio).map((h) => <option key={h}>{h}</option>)}
                      </select>
                      <span className="mutado">até</span>
                      <select className="entrada" aria-label={`${DIAS_LONGOS[dia]} fim`} value={f.hora_fim} onChange={(e) => mudarFaixa(f.i, 'hora_fim', e.target.value)}>
                        {opcoesHora(f.hora_fim).map((h) => <option key={h}>{h}</option>)}
                      </select>
                      <button className="btn-icone sem-borda" aria-label={`Remover faixa de ${DIAS_LONGOS[dia]}`} onClick={() => setDisp(disp.filter((_, j) => j !== f.i))}>
                        <Icone nome="fechar" tamanho={20} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="btn-link peq"
                    style={{ alignSelf: 'flex-start', padding: '2px 0', minHeight: 36 }}
                    onClick={() => setDisp([...disp, { dia_semana: dia, hora_inicio: faixas(dia).length ? '13:00' : '08:00', hora_fim: faixas(dia).length ? '18:00' : '12:00' }])}
                  >
                    <Icone nome="mais" tamanho={16} /> {faixas(dia).length ? 'Adicionar outra faixa' : 'Atender neste dia'}
                  </button>
                </div>
              ))}
            </div>
            <Erro>{horas.erro}</Erro>
            <button
              className="btn btn-primario"
              disabled={horas.ocupado}
              onClick={() =>
                horas.rodar(async () => {
                  for (const d of disp)
                    if (!d.hora_inicio || !d.hora_fim || paraMinutos(d.hora_fim) <= paraMinutos(d.hora_inicio))
                      throw new Error(`${DIAS_LONGOS[d.dia_semana]}: o fim deve ser depois do início.`)
                  await api.tecSalvarDisponibilidade(disp)
                  await recarregarConfig()
                  toast('Horários salvos.')
                })
              }
            >
              Salvar horários
            </button>
          </section>

          <section className="cartao coluna" aria-label="Aplicativo">
            <h2 className="subtitulo">Aplicativo</h2>
            {api.modo === 'demo' ? (
              permissao !== 'unsupported' && permissao !== 'granted' ? (
                <button className="btn btn-secundario" onClick={async () => setPermissao(await Notification.requestPermission())}>
                  <Icone nome="sino" /> Ativar avisos de novos pedidos
                </button>
              ) : (
                permissao === 'granted' && <p className="mutado peq">Avisos ativados (no modo demonstração, só com o app aberto).</p>
              )
            ) : (
              <AtivarAvisos tipo="tecnico" mostrarAtivo />
            )}
            <BotaoInstalar />
            <button className="btn btn-secundario" onClick={() => nav('/inicio')}>
              <Icone nome="inicio" /> Ver app do cliente
            </button>
            {api.modo === 'demo' && api.reiniciarDemo && (
              <button className="btn btn-secundario" onClick={() => setReiniciar(true)}>
                <Icone nome="historico" /> Reiniciar dados de demonstração
              </button>
            )}
            <button
              className="btn btn-perigo"
              onClick={async () => {
                await api.logout()
                nav('/tecnico/login', { replace: true })
              }}
            >
              <Icone nome="sair" /> Sair
            </button>
          </section>
        </div>
      </div>

      <RodapeVersao />

      {novoBloqueio && (
        <ModalBloqueio
          fechar={() => setNovoBloqueio(false)}
          salvar={async (b) => {
            await api.tecCriarBloqueio(b)
            setNovoBloqueio(false)
            carregarBloqueios()
            toast('Data bloqueada.')
          }}
        />
      )}
      <Modal titulo="Reiniciar demonstração?" aberto={reiniciar} fechar={() => setReiniciar(false)}>
        <p className="mutado">Apaga os dados deste aparelho e recria os exemplos.</p>
        <button
          className="btn btn-perigo"
          onClick={async () => {
            await api.reiniciarDemo?.()
            localStorage.removeItem('vini-cliente-token')
            window.location.reload()
          }}
        >
          Reiniciar
        </button>
      </Modal>
    </main>
  )
}

/** Horários de 30 em 30 min (05:00 a 23:00), incluindo o valor atual se for diferente. */
function opcoesHora(atual: string): string[] {
  const l: string[] = []
  for (let m = 5 * 60; m <= 23 * 60; m += 30) l.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)
  const a = atual.slice(0, 5)
  if (a && !l.includes(a)) l.push(a)
  return l.sort()
}

function textoBloqueio(b: Bloqueio) {
  const di = chaveDia(b.inicio)
  const df = chaveDia(new Date(new Date(b.fim).getTime() - 1).toISOString())
  const diaInteiro = horaDe(b.inicio) === '00:00' && horaDe(b.fim) === '00:00'
  if (diaInteiro) return di === df ? dataCurta(di) : `${dataCurta(di)} a ${dataCurta(df)}`
  return `${dataCurta(di)} · ${horaDe(b.inicio)}–${horaDe(b.fim)}`
}

function ModalBloqueio({ fechar, salvar }: { fechar: () => void; salvar: (b: Omit<Bloqueio, 'id'>) => Promise<void> }) {
  const hoje = hojeChave()
  const [de, setDe] = useState(hoje)
  const [ate, setAte] = useState(hoje)
  const [diaInteiro, setDiaInteiro] = useState(true)
  const [hi, setHi] = useState('08:00')
  const [hf, setHf] = useState('12:00')
  const [motivo, setMotivo] = useState('')
  const { ocupado, erro, rodar } = useAcao()
  return (
    <Modal titulo="Bloquear datas" aberto fechar={fechar}>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            const inicio = diaInteiro ? `${de}T00:00:00-03:00` : `${de}T${hi}:00-03:00`
            const fim = diaInteiro ? `${somarDias(ate, 1)}T00:00:00-03:00` : `${de}T${hf}:00-03:00`
            if (new Date(fim) <= new Date(inicio)) throw new Error('O fim deve ser depois do início.')
            await salvar({ inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(), motivo: motivo.trim() })
          })
        }}
      >
        <label className="linha" style={{ minHeight: 44 }}>
          <input type="checkbox" checked={diaInteiro} onChange={(e) => setDiaInteiro(e.target.checked)} style={{ width: 22, height: 22 }} />
          Dia inteiro
        </label>
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="bde">{diaInteiro ? 'De' : 'Dia'}</label>
            <input id="bde" type="date" className="entrada" min={hoje} value={de} onChange={(e) => { setDe(e.target.value); if (e.target.value > ate) setAte(e.target.value) }} required />
          </div>
          {diaInteiro && (
            <div className="campo">
              <label htmlFor="bate">Até</label>
              <input id="bate" type="date" className="entrada" min={de} value={ate} onChange={(e) => setAte(e.target.value)} required />
            </div>
          )}
        </div>
        {!diaInteiro && (
          <div className="grade-2">
            <div className="campo">
              <label htmlFor="bhi">Das</label>
              <input id="bhi" type="time" className="entrada" value={hi} onChange={(e) => setHi(e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="bhf">Até</label>
              <input id="bhf" type="time" className="entrada" value={hf} onChange={(e) => setHf(e.target.value)} />
            </div>
          </div>
        )}
        <div className="campo">
          <label htmlFor="bm">Motivo (opcional)</label>
          <input id="bm" className="entrada" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: feriado" />
        </div>
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          Bloquear
        </button>
      </form>
    </Modal>
  )
}
