# Matriz de funções e evidência

Esta matriz registra o estado da reimplementação pública. O inventário foi comparado ao README e à estrutura de módulos do aplicativo original; não representa uma auditoria linha a linha de todo o código privado.

| Capacidade do aplicativo de referência | Estado desta versão | Evidência / limite |
| --- | --- | --- |
| Conversa com Ollama | Implementada; geração real não validada | Consulta modelos locais e chama a API de chat; ausência do serviço exibida |
| Modelos GGUF via llama.cpp | Ausente | Sem integração direta |
| Seleção adaptativa por RAM/VRAM | Ausente | Seleção manual de modelo |
| Contexto adaptativo e fila FIFO | Parcial | Uma geração por vez, limite fixo de contexto; pedidos concorrentes recusados |
| Conversas e histórico | Implementado | Persistência local, últimos 100 registros; não possui busca de conversas |
| Interface nativa, temas e painéis destacáveis | Ausente | Substituída por interface web navy/roxa responsiva |
| Overlay / companhia | Parcial visual | Esfera roxa decorativa; sem janela flutuante ou reações |
| Voz offline faster-whisper / Kokoro / SAPI5 | Ausente | APIs opcionais de voz do navegador não equivalem ao original |
| Agenda de lembretes com alertas | Parcial | CRUD de compromissos; não dispara alertas ou notificações |
| Microagentes e investigação paralela | Ausente | Nenhum papel ou executor de agentes foi implementado |
| Pesquisa web e coleta de fontes | Ausente | Somente notas inseridas pelo usuário; não navega ou verifica URLs |
| Ferramentas de arquivos e sandbox | Ausente | Sem acesso a arquivos arbitrários do usuário |
| Automação Windows, shell e clipboard | Ausente | Sem executor ou comandos do modelo |
| Macros e tarefas encadeadas com confirmação | Ausente | Nenhuma automação ativa |
| Memória SQLite | Ausente | Notas e histórico persistem em JSON; arquitetura diferente |
| Auditoria | Implementada | Metadados de operações reais, até 1.000 entradas |
| Laboratório de aprendizado e propostas de habilidades | Ausente | Notas pesquisáveis não equivalem ao laboratório |
| Estudo periódico e pesquisa ociosa | Ausente | Sem atividades em segundo plano |
| Backup local criptografado | Parcial | Exportação/restauração manual autenticada por senha; sem agenda ou Git remoto |
| Atualização automática / assinatura / instalação Windows | Ausente | Execução local com Node; nenhum instalador publicado |
| Mensagens e resumos | Parcial | Importação manual de texto e chamada real a modelo local; não conecta contas |
| Tarefas e conclusão percentual | Implementada | Estado vazio inicial; percentual calculado somente dos registros do usuário |

## Resultado da revisão

O dashboard anterior continha mensagens e eventos fixos, automações sem executor, um score inicial arbitrário e botões sem ação. Esses comportamentos foram removidos. Os campos agora iniciam vazios, funções locais persistem registros reais e recursos ausentes são identificados.

Esta reimplementação é publicada como projeto em desenvolvimento, com funções locais disponíveis para teste e pendências explícitas. Ela ainda não contém todas as funções do original. A apresentação pública deve identificar esse estágio e apontar para o [roadmap](../ROADMAP.md).
