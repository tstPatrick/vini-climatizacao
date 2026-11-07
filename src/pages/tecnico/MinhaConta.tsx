import { useEffect, useState } from 'react'
import { Icone } from '../../components/Icone'
import { Erro, Modal, useAcao } from '../../components/ui'
import { useEstado } from '../../estado'

const senhaForte = (s: string) => s.length >= 10 && /[a-zA-Z]/.test(s) && /\d/.test(s)

/** "Minha conta" em Ajustes: e-mail de acesso, trocar senha e trocar e-mail. */
export function MinhaConta() {
  const { api } = useEstado()
  const [email, setEmail] = useState<string | null>(null)
  const [aberto, setAberto] = useState<'senha' | 'email' | null>(null)

  useEffect(() => {
    api.tecEmail().then(setEmail)
  }, [api])

  const botao = (tipo: 'senha' | 'email', icone: string, texto: string) => (
    <button className="cartao clicavel p linha" style={{ minHeight: 56 }} onClick={() => setAberto(tipo)}>
      <span className="icone-bola" style={{ width: 40, height: 40, minWidth: 40 }}>
        <Icone nome={icone} tamanho={20} />
      </span>
      <span className="cresce forte">{texto}</span>
      <Icone nome="direita" />
    </button>
  )

  return (
    <section className="cartao coluna" aria-label="Minha conta">
      <h2 className="subtitulo">Minha conta</h2>
      <div className="linha">
        <span className="icone-bola">
          <Icone nome="perfil" />
        </span>
        <div className="cresce coluna p" style={{ minWidth: 0 }}>
          <span className="rotulo">E-mail de acesso</span>
          <strong style={{ overflowWrap: 'anywhere' }}>{email ?? '—'}</strong>
        </div>
      </div>
      {botao('senha', 'chave', 'Trocar senha')}
      {botao('email', 'email', 'Trocar e-mail')}
      {aberto === 'senha' && <ModalSenha fechar={() => setAberto(null)} />}
      {aberto === 'email' && email && <ModalEmail atual={email} fechar={() => setAberto(null)} pronto={setEmail} />}
    </section>
  )
}

function ModalSenha({ fechar }: { fechar: () => void }) {
  const { api, toast } = useEstado()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [repetir, setRepetir] = useState('')
  const { ocupado, erro, rodar } = useAcao()
  return (
    <Modal titulo="Trocar senha" aberto fechar={fechar}>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            if (!senhaForte(nova)) throw new Error('A nova senha precisa ter pelo menos 10 caracteres, com letras e números.')
            if (nova !== repetir) throw new Error('As duas senhas novas não são iguais.')
            await api.tecTrocarSenha(atual, nova)
            toast('Senha alterada com sucesso.')
            fechar()
          })
        }}
      >
        <div className="campo">
          <label htmlFor="sa">Senha atual</label>
          <input id="sa" type="password" className="entrada" autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="sn">Nova senha</label>
          <input id="sn" type="password" className="entrada" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} required />
          <span className="mutado peq">Mínimo de 10 caracteres, com letras e números.</span>
        </div>
        <div className="campo">
          <label htmlFor="sr">Repita a nova senha</label>
          <input id="sr" type="password" className="entrada" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        </div>
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Salvar nova senha'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={fechar}>
          Cancelar
        </button>
      </form>
    </Modal>
  )
}

function ModalEmail({ atual, fechar, pronto }: { atual: string; fechar: () => void; pronto: (email: string) => void }) {
  const { api, toast } = useEstado()
  const [novo, setNovo] = useState('')
  const [senha, setSenha] = useState('')
  const { ocupado, erro, rodar } = useAcao()
  return (
    <Modal titulo="Trocar e-mail" aberto fechar={fechar}>
      <form
        className="coluna"
        onSubmit={(e) => {
          e.preventDefault()
          rodar(async () => {
            const email = novo.trim().toLowerCase()
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Informe um e-mail válido.')
            if (email === atual.toLowerCase()) throw new Error('Esse já é o seu e-mail de acesso.')
            await api.tecTrocarEmail(email, senha)
            pronto(email)
            toast('E-mail alterado com sucesso.')
            fechar()
          })
        }}
      >
        <p className="mutado">
          Atual: <strong>{atual}</strong>
        </p>
        <div className="campo">
          <label htmlFor="en">Novo e-mail</label>
          <input id="en" type="email" className="entrada" autoComplete="email" value={novo} onChange={(e) => setNovo(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="es">Sua senha (para confirmar)</label>
          <input id="es" type="password" className="entrada" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </div>
        <p className="mutado peq">Depois de salvar, use o novo e-mail para entrar no painel.</p>
        <Erro>{erro}</Erro>
        <button className="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Salvar novo e-mail'}
        </button>
        <button type="button" className="btn btn-secundario" onClick={fechar}>
          Cancelar
        </button>
      </form>
    </Modal>
  )
}
