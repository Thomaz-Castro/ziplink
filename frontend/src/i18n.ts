const pt = {
  common: {
    loading: "Carregando…",
    cancel: "Cancelar",
    save: "Salvar",
    edit: "Editar",
    delete: "Excluir",
    create: "Criar",
    update: "Atualizar",
    saving: "Salvando…",
    noData: "Nenhum dado encontrado.",
  },

  nav: {
    links: "Links",
    batch: "Importação em Lote",
    stats: "Estatísticas",
    logout: "Sair",
  },

  auth: {
    emailLabel: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    passwordLabel: "Senha",
    passwordHint: "mínimo 8 caracteres",

    login: {
      subtitle: "Entre na sua conta",
      submit: "Entrar",
      submitting: "Entrando…",
      footer: "Não tem uma conta?",
      footerLink: "Cadastre-se",
      errorFallback: "Falha ao entrar. Verifique suas credenciais.",
    },

    register: {
      subtitle: "Crie sua conta",
      submit: "Criar Conta",
      submitting: "Criando conta…",
      footer: "Já tem uma conta?",
      footerLink: "Entrar",
      errorFallback: "Falha ao criar conta.",
    },
  },

  links: {
    title: "Meus Links",
    newLink: "+ Novo Link",
    searchPlaceholder: "Buscar por URL, slug ou título…",
    emptyState: "Nenhum link ainda. Crie seu primeiro link encurtado!",
    deleteConfirm: "Excluir este link? Todos os dados de analytics serão perdidos.",
    saveErrorFallback: "Falha ao salvar o link.",

    modal: {
      createTitle: "Novo Link",
      editTitle: "Editar Link",
      urlLabel: "URL Original *",
      urlPlaceholder: "https://exemplo.com/caminho-longo",
      slugLabel: "Slug Personalizado",
      slugHint: "opcional, 3–20 chars",
      slugPlaceholder: "meu-link",
      titleLabel: "Título",
      titleHint: "opcional",
      titlePlaceholder: "Título descritivo",
      expiresLabel: "Expira em",
      expiresHint: "opcional",
    },

    table: {
      shortUrl: "Link Curto",
      destination: "Destino",
      clicks: "Cliques",
      status: "Status",
      createdAt: "Criado em",
      actions: "Ações",
      active: "Ativo",
      inactive: "Inativo",
    },

    pagination: {
      prev: "Anterior",
      next: "Próxima",
      page: (current: number, total: number) => `Página ${current} / ${total}`,
    },
  },

  batch: {
    title: "Importação em Lote",
    uploadTitle: "Enviar CSV ou JSON",
    uploadHint: (max: number) =>
      `Aceita <strong>.csv</strong> (colunas: <code>url, slug, title</code>) ou
       <strong>.json</strong> (array de objetos <code>{"url","slug","title"}</code>).
       Máximo de <strong>${max.toLocaleString()} URLs</strong> por arquivo.`,
    dropZonePrompt: "Solte o arquivo aqui ou",
    dropZoneBrowse: "clique para selecionar",
    dropZoneHint: "CSV ou JSON, máx. 5 MB",
    submit: "Enviar Lote",
    submitting: "Enviando…",
    uploadErrorFallback: "Falha no envio.",

    jobs: {
      title: "Importações",
      emptyState: "Nenhuma importação ainda.",
      total: "Total",
      success: "Sucesso",
      failed: "Falhas",
      processed: "Processado",
      showFailed: "Ver linhas com erro",
      hideFailed: "Ocultar linhas com erro",
      linePrefix: "Linha",
      moreErrors: (n: number) => `+${n} erro(s) adicionais`,
      downloadReport: "Baixar relatório completo (.csv)",
    },

    status: {
      pending: "pendente",
      processing: "processando",
      completed: "concluído",
      failed: "falhou",
    },
  },

  stats: {
    title: "Estatísticas",
    totalLinks: "Total de Links",
    activeLinks: "Links Ativos",
    totalClicks: "Total de Cliques",
    topLinksTitle: "Top Links por Cliques",
    emptyState: "Nenhum link ainda.",
    tableSlug: "Slug",
    tableTitle: "Título",
    tableClicks: "Cliques",
  },
};

export default pt;
