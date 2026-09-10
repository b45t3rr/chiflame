export const HELP = `chifla — encrypted notifications

Usage:
  chifla "message"                 send to default channel (inbox)
  chifla send [channel] <msg>
  chifla run [flags] <cmd...>      run command and notify on completion
  chifla wait [flags] <PID>        watch existing process and notify on exit
  chifla auth pair                 QR pairing (TTY)
  chifla auth status
  chifla auth unpair
  chifla channels
  chifla channels create <slug>
  chifla devices
  chifla whoami

Flags:
  --json            JSON on stdout
  -q, --quiet       no human logs
  -c, --channel     channel slug
  -t, --title       title
  -p, --priority    min|low|default|high|urgent
  --ttl             30s|5m|1h|7d
  --click           https URL
  --on-error        only notify if command fails (for run)
  --lines <N>       capture last N lines of output (default: 15)
  --interval <sec>  polling interval in seconds (for wait, default: 1)
  --config          config path
  --server          Supabase URL

Agent-friendly: chifla "message"   JSON: --json   quiet: -q
`

