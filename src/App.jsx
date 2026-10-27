import { useEffect, useRef, useState } from 'react'
import { Bot, CalendarDays, Check, Download, FileText, Gauge, Home, Mail, Menu, Mic, Settings, ShieldCheck, Sparkles, Trash2, Volume2, Zap } from 'lucide-react'

const empty = { tasks: [], events: [], messages: [], notes: [], audit: [], conversations: [] }

function Card({ children, className = '', id }) {
  return <section id={id} className={`card ${className}`}>{children}</section>
}

function App() {
  const [workspace, setWorkspace] = useState(empty)
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [connection, setConnection] = useState('Verificando Ollama…')
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [query, setQuery] = useState('')
  const [password, setPassword] = useState('')
  const [speechStatus, setSpeechStatus] = useState('')
  const csrf = useRef('')
  const recognition = useRef(null)

  async function api(path, method = 'GET', data) {
    const response = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Nyx-CSRF': csrf.current }, body: data === undefined ? undefined : JSON.stringify(data) })
    const value = await response.json()
    if (!response.ok) throw new Error(value.error || 'Falha no serviço local')
    return value
  }

  async function refresh() {
    const state = await api('state')
    csrf.current = state.csrf
    setWorkspace(state)
    setReady(true)
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const response = await fetch('/api/state')
        if (!response.ok) throw new Error('O serviço local não respondeu')
        const data = await response.json()
        if (mounted) { csrf.current = data.csrf; setWorkspace(data); setReady(true) }
      } catch { if (mounted) setError('Não foi possível acessar o serviço local. Execute npm start e abra o endereço exibido.') }
      try {
        const response = await fetch('/api/models')
        const data = await response.json()
        if (mounted) { setModels(data.models ?? []); setModel(data.models?.[0] ?? ''); setConnection(data.connected ? `${data.models.length} modelo(s) instalado(s)` : 'Ollama indisponível neste computador') }
      } catch { if (mounted) setConnection('Serviço local indisponível') }
    }
    load()
    return () => { mounted = false; recognition.current?.stop() }
  }, [])

  async function mutate(path, method, data) {
    setError('')
    try { await api(path, method, data); await refresh(); return true }
    catch (failure) { setError(failure.message); return false }
  }

  async function addItem(event, kind) {
    event.preventDefault()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    if (data.at) data.at = new Date(data.at).toISOString()
    if (await mutate(kind, 'POST', data)) form.reset()
  }

  async function generate(text, mode) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const result = await api('chat', 'POST', { prompt: text, model, mode })
      setAnswer(result.answer)
      await refresh()
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  function startVoice() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { setSpeechStatus('Reconhecimento de voz não disponível neste navegador.'); return }
    recognition.current?.stop()
    const engine = new SpeechRecognition()
    recognition.current = engine
    engine.lang = 'pt-BR'
    engine.onresult = event => { setPrompt(event.results[0][0].transcript); setSpeechStatus('Transcrição recebida. Revise antes de enviar.') }
    engine.onerror = () => setSpeechStatus('Não foi possível transcrever. Verifique a permissão do microfone.')
    engine.onend = () => setSpeechStatus(current => current === 'Ouvindo…' ? 'Escuta encerrada.' : current)
    try { engine.start(); setSpeechStatus('Ouvindo…') } catch { setSpeechStatus('O microfone não pôde ser iniciado.') }
  }

  function speak() {
    if (!('speechSynthesis' in window)) { setSpeechStatus('Leitura de voz indisponível neste navegador.'); return }
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(answer)
    speech.lang = 'pt-BR'
    window.speechSynthesis.speak(speech)
  }

  async function backup() {
    setError('')
    try {
      const data = await api('backup', 'POST', { password })
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'nyx-backup.encrypted.json'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setPassword('')
    } catch (failure) { setError(failure.message) }
  }

  async function restore(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 15000000) { setError('Backup muito grande. Limite: 15 MB.'); return }
    if (!window.confirm('Restaurar este backup substituirá os dados deste workspace. Deseja continuar?')) return
    try {
      const data = JSON.parse(await file.text())
      if (await mutate('restore', 'POST', { password, backup: data })) setPassword('')
    } catch { setError('Arquivo de backup inválido.') }
  }

  const today = new Date().toLocaleDateString()
  const todayEvents = workspace.events.filter(event => new Date(event.at).toLocaleDateString() === today).sort((first, second) => Date.parse(first.at) - Date.parse(second.at))
  const completed = workspace.tasks.filter(task => task.done).length
  const score = workspace.tasks.length ? Math.round(completed / workspace.tasks.length * 100) : null
  const filteredNotes = workspace.notes.filter(note => `${note.title} ${note.body ?? ''}`.toLowerCase().includes(query.toLowerCase()))

  return <main className="app-shell">
    <a className="skip-link" href="#overview">Pular para o conteúdo</a>
    <button className="menu-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Alternar navegação" aria-expanded={sidebarOpen}><Menu /></button>
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} aria-label="Navegação principal">
      <a className="brand" href="#overview" aria-label="Nyx"><Sparkles size={19} /></a>
      <nav>{[[Home, 'overview', 'Início'], [Bot, 'chat', 'Conversa'], [Mail, 'email', 'Mensagens'], [CalendarDays, 'calendar', 'Agenda'], [FileText, 'research', 'Pesquisa'], [Gauge, 'focus', 'Foco']].map(([Icon, id, label]) => <a key={id} className="nav-link" href={`#${id}`} aria-label={label}><Icon size={20} /></a>)}</nav>
      <a className="nav-link settings" href="#settings" aria-label="Configurações"><Settings /></a>
    </aside>
    <div className="content" id="overview">
      <header className="hero"><div><p className="eyebrow"><Sparkles size={14} /> NYX · WORKSPACE LOCAL</p><h1>Seu dia, com foco <span>✦</span></h1><p className="intro">{new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' })}</p></div><div className="orbital-art" aria-hidden="true"><span className="orb one" /></div></header>
      <div className="notice" role="status"><ShieldCheck size={16} /> {ready ? 'Dados deste workspace salvos neste computador.' : 'Conectando ao workspace…'} {connection}.</div>
      {error && <div role="alert" className="error-message">{error}</div>}
      <div className="dashboard-grid">
        <Card id="email" className="email-card"><h2 className="card-title"><span><Mail /> Email Summary</span><b>{workspace.messages.length} importadas</b></h2>
          <p className="systems-copy">Cole uma mensagem sua para resumir. Conexão automática com email ainda indisponível.</p>
          {workspace.messages.length === 0 && <p className="empty-state">Nenhuma mensagem importada.</p>}
          {workspace.messages.map(message => <article className="data-item" key={message.id}><strong>{message.title}</strong><p>{message.body}</p><button disabled={busy || !model} onClick={() => generate(`Resuma esta mensagem fornecida pelo usuário:\n${message.title}\n${message.body ?? ''}`)}>Resumir com modelo local</button><button className="delete-button" aria-label={`Excluir mensagem ${message.title}`} onClick={() => mutate(`messages/${message.id}`, 'DELETE')}><Trash2 size={14} /></button></article>)}
          <form className="entry-form" onSubmit={event => addItem(event, 'messages')}><label>Assunto<input name="title" required maxLength={200} /></label><label>Mensagem<textarea name="body" required maxLength={20000} /></label><button disabled={!ready}>Importar texto</button></form>
        </Card>
        <Card id="calendar" className="calendar-card"><h2 className="card-title"><span><CalendarDays /> Calendar Today</span><b>{todayEvents.length} hoje</b></h2>
          {todayEvents.length === 0 && <p className="empty-state">Nenhum compromisso para hoje.</p>}
          {workspace.events.slice().sort((first, second) => Date.parse(first.at) - Date.parse(second.at)).map(event => <article className="data-item" key={event.id}><time dateTime={event.at}>{new Date(event.at).toLocaleString('pt-BR')}</time><strong>{event.title}</strong><button className="delete-button" aria-label={`Excluir compromisso ${event.title}`} onClick={() => mutate(`events/${event.id}`, 'DELETE')}><Trash2 size={14} /></button></article>)}
          <form className="entry-form" onSubmit={event => addItem(event, 'events')}><label>Compromisso<input name="title" required maxLength={200} /></label><label>Data e horário<input name="at" type="datetime-local" required /></label><button disabled={!ready}>Salvar compromisso</button></form>
          <p className="systems-copy">Agenda local. Alertas em segundo plano e sincronização ainda indisponíveis.</p>
        </Card>
        <Card id="research" className="research-card"><h2 className="card-title"><span><FileText /> Research Brief</span></h2>
          <label className="search-label">Buscar notas<input value={query} onChange={event => setQuery(event.target.value)} type="search" /></label>
          {filteredNotes.length === 0 && <p className="empty-state">Nenhuma nota encontrada.</p>}
          {filteredNotes.map(note => <article className="data-item" key={note.id}><strong>{note.title}</strong><p>{note.body}</p>{note.source && <p>Fonte informada: {note.source}</p>}<button className="delete-button" aria-label={`Excluir nota ${note.title}`} onClick={() => mutate(`notes/${note.id}`, 'DELETE')}><Trash2 size={14} /></button></article>)}
          <form className="entry-form" onSubmit={event => addItem(event, 'notes')}><label>Título<input name="title" required maxLength={200} /></label><label>Nota<textarea name="body" required maxLength={20000} /></label><label>Fonte (opcional)<input name="source" maxLength={2000} /></label><button disabled={!ready}>Salvar nota</button></form>
          <button className="outline-button" disabled={busy || !model || !workspace.notes.length} onClick={() => generate('Resuma as notas fornecidas. Identifique fontes informadas e lacunas. Não invente fatos nem URLs.', 'research')}>Gerar resumo das notas</button>
        </Card>
        <Card id="chat" className="automation-card"><h2 className="card-title"><span><Bot /> Conversa local</span><b>{busy ? 'Processando…' : model ? 'Modelo selecionado' : 'Sem modelo'}</b></h2>
          <form className="entry-form" onSubmit={event => { event.preventDefault(); generate(prompt) }}><label>Modelo Ollama instalado<select value={model} onChange={event => setModel(event.target.value)} disabled={busy}>{!models.length && <option value="">Nenhum modelo disponível</option>}{models.map(name => <option key={name}>{name}</option>)}</select></label><label>Sua mensagem<textarea value={prompt} onChange={event => setPrompt(event.target.value)} required maxLength={20000} /></label><button disabled={!ready || busy || !model}>Enviar ao modelo local</button></form>
          <div className="voice-controls"><button onClick={startVoice}><Mic size={15} /> Ditar</button><button disabled={!answer} onClick={speak}><Volume2 size={15} /> Ler resposta</button></div>
          <p className="systems-copy">Ditado usa o serviço do navegador e pode enviar áudio ao fornecedor. Ative apenas se concordar. Não é a voz offline do app original.</p><p role="status">{speechStatus}</p>
          {answer && <div className="answer" aria-live="polite"><strong>Resposta do modelo</strong><p>{answer}</p></div>}
          <details><summary>Histórico local ({workspace.conversations.length})</summary>{workspace.conversations.slice().reverse().map(item => <article key={item.id} className="data-item"><strong>{item.prompt}</strong><p>{item.answer}</p><time dateTime={item.at}>{new Date(item.at).toLocaleString('pt-BR')}</time></article>)}</details>
        </Card>
        <Card id="focus" className="focus-card"><h2 className="card-title"><span><Gauge /> Today’s Focus</span></h2>
          {!workspace.tasks.length && <p className="empty-state">Adicione sua primeira tarefa.</p>}
          <div className="focus-list">{workspace.tasks.map(task => <div className="task-row" key={task.id}><button className={task.done ? 'done' : ''} aria-pressed={task.done} onClick={() => mutate(`tasks/${task.id}`, 'PATCH', { done: !task.done })}><span><Check size={13} /></span>{task.title}</button><button className="delete-button" aria-label={`Excluir tarefa ${task.title}`} onClick={() => mutate(`tasks/${task.id}`, 'DELETE')}><Trash2 size={14} /></button></div>)}</div>
          <form className="entry-form" onSubmit={event => addItem(event, 'tasks')}><label>Tarefa<input name="title" required maxLength={200} /></label><button disabled={!ready}>Adicionar tarefa</button></form>
          <div className="score"><div><strong>Focus Score</strong><p>{completed} de {workspace.tasks.length} tarefas concluídas. Percentual de conclusão, não medição cognitiva.</p></div><b style={{ '--score': `${score ?? 0}%` }}><span>{score === null ? '—' : `${score}%`}</span></b></div>
        </Card>
        <Card id="automations" className="systems-card"><h2 className="card-title"><span><Zap /> Automations</span><b>Indisponível</b></h2><p className="systems-copy">O executor de automações, os microagentes e a automação de Windows ainda não foram reimplementados nesta versão. Não há rotinas ativas nem ações executadas pelo modelo.</p></Card>
        <Card id="settings" className="systems-card"><h2 className="card-title"><span><Settings /> Memória, auditoria e backup</span></h2><p className="systems-copy">Notas e histórico formam a memória local. A auditoria registra operações reais sem repetir o conteúdo das mensagens. O backup usa senha e criptografia AES-256-GCM; guarde a senha fora deste aplicativo.</p>
          <div className="backup-controls"><label>Senha de backup (mínimo 12 caracteres)<input type="password" autoComplete="new-password" value={password} minLength={12} maxLength={256} onChange={event => setPassword(event.target.value)} /></label><button disabled={!ready || password.length < 12} onClick={backup}><Download size={15} /> Exportar backup criptografado</button><label className="upload-label">Restaurar backup<input type="file" accept="application/json,.json" disabled={!ready || password.length < 12} onChange={restore} /></label></div>
          <details><summary>Auditoria ({workspace.audit.length})</summary><ul className="audit-list">{workspace.audit.map(entry => <li key={entry.id}><time dateTime={entry.at}>{new Date(entry.at).toLocaleString('pt-BR')}</time> · {entry.action} · {entry.kind}</li>)}</ul></details>
        </Card>
      </div>
      <footer>Nyx · Versão em desenvolvimento · Consulte a matriz de funções antes de avaliar o projeto.</footer>
    </div>
  </main>
}

export default App
