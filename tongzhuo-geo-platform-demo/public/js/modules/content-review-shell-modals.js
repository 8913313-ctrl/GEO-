// Shell-level search, notification, and publisher pairing modals.
// Kept as a classic-script module to preserve existing global actions.

function renderSearchModal() {
  return modalChrome(`
    <div class="search-box"><span data-icon="search"></span><input id="command-input" value="${escapeHtml(ui.commandQuery)}" placeholder="搜索页面或操作…" autocomplete="off" /></div>
    <div class="command-list" id="command-list">${commandResultsHtml()}</div>
  `);
}

function commandResultsHtml() {
  const commands = [
    { route: "planning", icon: "sparkle", title: "选题中心", description: "维护关键词、问题词库、选题库和内容计划", keys: "选题中心 关键词 问题 内容计划" },
    { route: "content", icon: "file", title: "内容生产", description: "打开文章列表与审核工作流", keys: "文章 审核 写作" },
    { action: "publish-approved", icon: "send", title: "发布已通过文章", description: "选择账号组与发布平台", keys: "发布 微信 知乎 头条" },
    { route: "assets", icon: "folder", title: "内容资产", description: "管理文章版本、官网信源与多平台分发关系", keys: "资产 版本 信源 引用 内容" },
    { route: "monitoring", icon: "chart", title: "运营诊断", description: "查看行业研究、网站诊断与生产发布运行状态", keys: "运营 诊断 研究 信源 爬虫 访问 运行" },
    { route: "knowledge", icon: "book", title: "企业知识", description: "管理产品、案例、FAQ 与资料", keys: "企业资料 知识库" },
    { route: "assistant", icon: "monitor", title: "发布助手", description: "查看设备和平台账号状态", keys: "设备 账号组 登录" },
    { route: "site", icon: "globe", title: "官网运营", description: "预览官网、管理线索与站点设置", keys: "网站 官网 诊断" }
  ];
  const query = ui.commandQuery.trim().toLowerCase();
  const filtered = commands.filter((command) => !query || (command.title + command.description + command.keys).toLowerCase().includes(query));
  if (!filtered.length) return '<div class="empty-state compact"><div><span data-icon="search"></span><h3>没有匹配结果</h3><p>换一个关键词试试。</p></div></div>';
  return filtered.map((command) => `
    <button class="command-item" type="button" data-command-route="${command.route || ""}" data-command-action="${command.action || ""}">
      <span data-icon="${command.icon}"></span><span><b>${command.title}</b><small>${command.description}</small></span><kbd>↵</kbd>
    </button>
  `).join("");
}

function renderNotificationsModal() {
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">通知</h2><p>1 条需要处理的运营消息</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body">
      <button class="todo-item" type="button" data-action="notification-task">
        <span class="todo-icon red" data-icon="alert"></span><span class="todo-copy"><strong>头条号发布结果待核验</strong><span>平台提交后连接中断，为避免重复发文，任务已暂停自动重试。</span></span><span class="todo-meta"><i class="todo-arrow">›</i></span>
      </button>
      <div class="todo-item"><span class="todo-icon" data-icon="check"></span><span class="todo-copy"><strong>企业知识同步完成</strong><span>36 份资料已完成更新，可用于内容生成。</span></span><span class="todo-meta"><small>1小时前</small></span></div>
    </div>
  `);
}


function renderPairModal() {
  const code = ui.pairingCode || "正在生成配对码…";
  const expires = ui.pairingExpiresAt ? new Date(ui.pairingExpiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "10分钟内有效";
  return modalChrome(`
    <div class="modal-head"><div><h2 id="modal-title">配对本地 GEO 发布器</h2><p>将当前客户后台与 Windows 桌面软件连接</p></div><button class="icon-button" data-action="close-modal" aria-label="关闭"><span data-icon="x"></span></button></div>
    <div class="modal-body text-center">
      <span class="device-icon" data-icon="monitor"></span>
      <p class="pairing-note">在桌面发布器的“绑定节点”中填写当前后台地址和下面的配对码。</p>
      <div class="pairing-code">${escapeHtml(code)}</div>
      <p class="pairing-note small">${escapeHtml(expires)}</p>
      <div class="security-inline text-left"><span data-icon="lock"></span><span>配对只建立设备令牌。平台密码、Cookie、验证码和浏览器 Profile 只保存在客户电脑。</span></div>
    </div>
    <div class="modal-foot"><span>桌面软件完成绑定后会显示在线</span><div class="modal-foot-right"><button class="secondary-button" data-action="refresh-publisher"><span data-icon="refresh"></span>刷新状态</button><button class="secondary-button" data-action="close-modal">完成</button></div></div>
  `);
}

async function issuePublisherPairing() {
  try {
    ui.pairingCode = null;
    ui.pairingExpiresAt = null;
    renderModal();
    const result = await publisherApi("/api/publisher/pairings", { method: "POST", body: {} });
    ui.pairingCode = result.pairing?.code || "";
    ui.pairingExpiresAt = result.pairing?.expiresAt || null;
    renderModal();
  } catch (error) {
    showToast("配对码生成失败", error.message, "error");
  }
}
