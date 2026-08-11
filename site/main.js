/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Beta
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
const localeTargets = {
  navWorkflow: [".dock-links a:nth-child(1)"], navCapabilities: [".dock-links a:nth-child(2)"], navLocal: [".dock-links a:nth-child(3)"], navRoadmap: [".dock-links a:nth-child(4)"], navOpen: [".dock-cta span"],
  heroTitle: [".hero h1", "html"], heroLead: [".hero-lead"], heroTry: [".hero-actions .button-primary span"],
  chipAgentTitle: [".chip-agent b"], chipAgentText: [".chip-agent small"], chipSaveTitle: [".chip-save b"], chipSaveText: [".chip-save small"],
  manifesto: [".manifesto h2", "html"], workflowTitle: [".workflow .section-heading h2", "html"], workflowText: [".workflow .section-heading > p"], workflowCaption: [".screen-frame figcaption b"],
  workflow1Title: [".workflow-steps li:nth-child(1) b"], workflow1Text: [".workflow-steps li:nth-child(1) p"], workflow2Title: [".workflow-steps li:nth-child(2) b"], workflow2Text: [".workflow-steps li:nth-child(2) p"], workflow3Title: [".workflow-steps li:nth-child(3) b"], workflow3Text: [".workflow-steps li:nth-child(3) p"],
  capabilitiesTitle: [".capabilities .section-heading h2", "html"], canvasTitle: [".canvas-card .card-copy h3"], canvasText: [".canvas-card .card-copy p"], refNode: [".node-source b"], outputNode: [".node-output b"], assetNode: [".node-asset b"],
  modelTitle: [".model-card h3"], modelText: [".model-card p"], assetTitle: [".asset-card h3"], assetText: [".asset-card p"], historyTitle: [".history-card h3"], historyText: [".history-card p"],
  localTitle: [".local-copy h2", "html"], localText: [".local-copy > p"], local1: [".local-points div:nth-child(1) span"], local2: [".local-points div:nth-child(2) span"], local3: [".local-points div:nth-child(3) span"],
  roadmapTitle: [".roadmap-heading h2"], roadmapText: [".roadmap-heading > p"], road1Title: [".roadmap-list article:nth-child(1) h3"], road1Text: [".roadmap-list article:nth-child(1) p"], road2Title: [".roadmap-list article:nth-child(2) h3"], road2Text: [".roadmap-list article:nth-child(2) p"], road3Title: [".roadmap-list article:nth-child(3) h3"], road3Text: [".roadmap-list article:nth-child(3) p"], road4Title: [".roadmap-list article:nth-child(4) h3"], road4Text: [".roadmap-list article:nth-child(4) p"],
  closingTitle: [".closing h2", "html"], closingStart: [".closing-actions .button-primary span"], closingRepo: [".closing-actions .button-ghost span"], footerText: [".site-footer > p"], footerLicense: [".site-footer > a"]
};

const localeContent = {
  "zh-CN": {
    title: "DisyLab · 让创作过程留在画布上", description: "DisyLab：把灵感、参考图、提示词、Agent 对话与生成结果留在同一张无限画布。", rail: ["首页", "定位", "工作流", "能力", "本地优先", "路线图", "开始创作"],
    navWorkflow: "工作流", navCapabilities: "能力", navLocal: "本地优先", navRoadmap: "路线图", navOpen: "打开画布", heroTitle: "让创作过程<br><em>留在画布上。</em>", heroLead: "把灵感、参考图、提示词、Agent 对话和每一次生成结果，放回同一张持续生长的无限画布。", heroTry: "在线体验", chipAgentTitle: "Agent 已整理 3 个方向", chipAgentText: "确认之后才让 GPU 开工", chipSaveTitle: "已保存到本机", chipSaveText: "项目数据不离开浏览器", manifesto: "不是又一个输入框。<br>是一间记得住上下文的<br><em>AI 创作工作台。</em>",
    workflowTitle: "从一个念头，<br>长出多个清晰方向。", workflowText: "Agent 先理解上下文、整理方案，再由你决定生成哪一个。每个方向独立，参考关系完整，不把关键词煮成一锅粥。", workflowCaption: "每个方案独立确认", workflow1Title: "放入上下文", workflow1Text: "拖入参考图、文本、角色和已有结果。", workflow2Title: "选择创作方向", workflow2Text: "Agent 给出多个彼此独立的视觉方案。", workflow3Title: "确认后生成", workflow3Text: "参数、参考顺序与来源关系一起被保留。",
    capabilitiesTitle: "自由生长，<br>也能保持秩序。", canvasTitle: "关系，不必藏在文件名里", canvasText: "节点、连线、分组、资产与历史共同构成创作上下文。你看到的不只是结果，也是它为何出现。", refNode: "角色参考", outputNode: "视觉方案 03", assetNode: "加入资产库", modelTitle: "自己的 API，自己的模型", modelText: "分别配置文本与图像模型，让工具适配你的工作流。", assetTitle: "好结果继续生长", assetText: "角色、图片和节点组合都能沉淀为下一次创作的起点。", historyTitle: "版本、参数、参考顺序，都有迹可循", historyText: "生成历史不只负责“找回图片”，也负责保留每次尝试的决策依据。",
    localTitle: "你的创作，<br>先属于你的设备。", localText: "项目、资产、历史和 Agent 会话默认保存在浏览器本机。API Key 不进入项目导出包，也不需要交给 DisyLab 的服务器。", local1: "浏览器本地存储", local2: ".disy 完整项目包", local3: "API Key 独立保存", roadmapTitle: "画布还会继续生长。", roadmapText: "DisyLab 聚焦视觉创作：从图片到视频，从单人工作台到可分享的创作空间。", road1Title: "无限画布与 Agent 创作闭环", road1Text: "节点、分组、引用、多方案、生图、资产与项目包。", road2Title: "视频生成与首尾帧工作流", road2Text: "视频模型、参考图、任务状态与视频资产管理。", road3Title: "人物、场景与分镜预设", road3Text: "将更复杂的视觉设定组合、调用并跨项目复用。", road4Title: "桌面端、同步与协作", road4Text: "在保持创作控制权的前提下连接更多工作场景。", closingTitle: "让下一张画面，<br>从一张会思考的画布开始。", closingStart: "开始创作", closingRepo: "查看仓库", footerText: "源码公开可见，但未经书面许可禁止商用、白标与再分发。", footerLicense: "授权说明 ↗"
  },
  "zh-TW": {
    title: "DisyLab · 讓創作過程留在畫布上", description: "DisyLab：把靈感、參考圖、提示詞、Agent 對話與生成結果留在同一張無限畫布。", rail: ["首頁", "定位", "工作流", "能力", "本機優先", "路線圖", "開始創作"],
    navWorkflow: "工作流", navCapabilities: "能力", navLocal: "本機優先", navRoadmap: "路線圖", navOpen: "開啟畫布", heroTitle: "讓創作過程<br><em>留在畫布上。</em>", heroLead: "把靈感、參考圖、提示詞、Agent 對話和每一次生成結果，放回同一張持續生長的無限畫布。", heroTry: "線上體驗", chipAgentTitle: "Agent 已整理 3 個方向", chipAgentText: "確認之後才讓 GPU 開工", chipSaveTitle: "已儲存到本機", chipSaveText: "專案資料不離開瀏覽器", manifesto: "不是又一個輸入框。<br>是一間記得住上下文的<br><em>AI 創作工作台。</em>",
    workflowTitle: "從一個念頭，<br>長出多個清晰方向。", workflowText: "Agent 先理解上下文、整理方案，再由你決定生成哪一個。每個方向獨立，參考關係完整，不把關鍵詞煮成一鍋粥。", workflowCaption: "每個方案獨立確認", workflow1Title: "放入上下文", workflow1Text: "拖入參考圖、文字、角色和已有結果。", workflow2Title: "選擇創作方向", workflow2Text: "Agent 給出多個彼此獨立的視覺方案。", workflow3Title: "確認後生成", workflow3Text: "參數、參考順序與來源關係一起被保留。",
    capabilitiesTitle: "自由生長，<br>也能保持秩序。", canvasTitle: "關係，不必藏在檔名裡", canvasText: "節點、連線、分組、資產與歷史共同構成創作上下文。你看到的不只是結果，也是它為何出現。", refNode: "角色參考", outputNode: "視覺方案 03", assetNode: "加入資產庫", modelTitle: "自己的 API，自己的模型", modelText: "分別設定文字與圖像模型，讓工具適配你的工作流。", assetTitle: "好結果繼續生長", assetText: "角色、圖片和節點組合都能沉澱為下一次創作的起點。", historyTitle: "版本、參數、參考順序，都有跡可循", historyText: "生成歷史不只負責「找回圖片」，也負責保留每次嘗試的決策依據。",
    localTitle: "你的創作，<br>先屬於你的裝置。", localText: "專案、資產、歷史和 Agent 會話預設儲存在瀏覽器本機。API Key 不進入專案匯出包，也不需要交給 DisyLab 的伺服器。", local1: "瀏覽器本機儲存", local2: ".disy 完整專案包", local3: "API Key 獨立儲存", roadmapTitle: "畫布還會繼續生長。", roadmapText: "DisyLab 聚焦視覺創作：從圖片到影片，從單人工作台到可分享的創作空間。", road1Title: "無限畫布與 Agent 創作閉環", road1Text: "節點、分組、引用、多方案、生圖、資產與專案包。", road2Title: "影片生成與首尾幀工作流", road2Text: "影片模型、參考圖、任務狀態與影片資產管理。", road3Title: "人物、場景與分鏡預設", road3Text: "將更複雜的視覺設定組合、調用並跨專案複用。", road4Title: "桌面端、同步與協作", road4Text: "在保持創作控制權的前提下連接更多工作場景。", closingTitle: "讓下一張畫面，<br>從一張會思考的畫布開始。", closingStart: "開始創作", closingRepo: "查看倉庫", footerText: "原始碼公開可見，但未經書面許可禁止商用、白標與再散布。", footerLicense: "授權說明 ↗"
  },
  en: {
    title: "DisyLab · Keep the creative process on canvas", description: "DisyLab keeps ideas, references, prompts, Agent conversations, and generations together on one infinite canvas.", rail: ["Home", "Vision", "Workflow", "Features", "Local first", "Roadmap", "Create"],
    navWorkflow: "Workflow", navCapabilities: "Features", navLocal: "Local first", navRoadmap: "Roadmap", navOpen: "Open canvas", heroTitle: "Keep the process<br><em>on the canvas.</em>", heroLead: "Bring ideas, references, prompts, Agent conversations, and every generated result back onto one continuously growing infinite canvas.", heroTry: "Try online", chipAgentTitle: "Agent mapped 3 directions", chipAgentText: "Generation waits for your approval", chipSaveTitle: "Saved on this device", chipSaveText: "Project data stays in your browser", manifesto: "Not another prompt box.<br>A creative workspace that<br><em>remembers the context.</em>",
    workflowTitle: "One thought.<br>Multiple clear directions.", workflowText: "The Agent understands your context and organizes options before you generate. Each direction stays independent, with its references and intent intact.", workflowCaption: "Approve each direction independently", workflow1Title: "Bring the context", workflow1Text: "Drop in references, text, characters, and existing results.", workflow2Title: "Choose a direction", workflow2Text: "The Agent proposes distinct visual approaches.", workflow3Title: "Generate with intent", workflow3Text: "Parameters, reference order, and source relationships remain traceable.",
    capabilitiesTitle: "Grow freely.<br>Stay organized.", canvasTitle: "Relationships belong on canvas", canvasText: "Nodes, links, groups, assets, and history form the creative context. You see not only the result, but why it exists.", refNode: "Character ref", outputNode: "Direction 03", assetNode: "Save as asset", modelTitle: "Your API. Your models.", modelText: "Configure text and image models separately to fit your workflow.", assetTitle: "Great results keep growing", assetText: "Characters, images, and node groups become starting points for the next idea.", historyTitle: "Versions, parameters, references — traceable", historyText: "Generation history preserves the decisions behind every experiment, not just the final image.",
    localTitle: "Your work belongs<br>on your device first.", localText: "Projects, assets, history, and Agent conversations stay in your browser by default. API keys never enter exported project packages or DisyLab servers.", local1: "Browser-local storage", local2: "Complete .disy packages", local3: "API keys stored separately", roadmapTitle: "The canvas keeps growing.", roadmapText: "DisyLab is expanding from images to video, and from a personal desk to shareable creative spaces.", road1Title: "Infinite canvas + Agent loop", road1Text: "Nodes, groups, references, directions, generation, assets, and project packages.", road2Title: "Video and keyframe workflows", road2Text: "Video models, references, task states, and video asset management.", road3Title: "Characters, scenes, and shots", road3Text: "Build reusable visual systems that travel across projects.", road4Title: "Desktop, sync, and collaboration", road4Text: "Connect more workflows without giving up creative control.", closingTitle: "Let the next frame begin<br>on a canvas that can think.", closingStart: "Start creating", closingRepo: "View repository", footerText: "Source-visible proprietary software. Commercial use, white-labeling, and redistribution require written permission.", footerLicense: "License terms ↗"
  }
};

function applyLocale(locale) {
  const copy = localeContent[locale] || localeContent["zh-CN"];
  document.documentElement.lang = locale;
  document.documentElement.dataset.locale = locale;
  document.title = copy.title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", copy.description);
  Object.entries(localeTargets).forEach(([key, [selector, mode]]) => {
    const element = document.querySelector(selector);
    if (!element || copy[key] == null) return;
    if (mode === "html") element.innerHTML = copy[key];
    else element.textContent = copy[key];
  });
  document.querySelectorAll(".page-rail > a").forEach((link, index) => { link.dataset.label = copy.rail[index]; });
  document.querySelectorAll("[data-locale]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.locale === locale)));
  try { localStorage.setItem("disylab-site-locale", locale); } catch {}
  requestAnimationFrame(() => window.ScrollTrigger?.refresh());
}

function initLocale() {
  let savedLocale = "zh-CN";
  try { savedLocale = localStorage.getItem("disylab-site-locale") || "zh-CN"; } catch {}
  applyLocale(localeContent[savedLocale] ? savedLocale : "zh-CN");
  document.querySelectorAll("[data-locale]").forEach((button) => button.addEventListener("click", () => applyLocale(button.dataset.locale)));
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;

function initCursorGlow() {
  if (!finePointer || reducedMotion) return;
  const glow = document.querySelector(".cursor-glow");
  if (!glow) return;
  if (window.gsap) {
    const moveX = gsap.quickTo(glow, "x", { duration: .55, ease: "power3.out" });
    const moveY = gsap.quickTo(glow, "y", { duration: .55, ease: "power3.out" });
    window.addEventListener("pointermove", (event) => {
      moveX(event.clientX);
      moveY(event.clientY);
    }, { passive: true });
    return;
  }
  window.addEventListener("pointermove", (event) => {
    glow.style.transform = `translate(${event.clientX - 240}px, ${event.clientY - 240}px)`;
  }, { passive: true });
}

function initProductTilt() {
  if (!finePointer || reducedMotion) return;
  const target = document.querySelector("[data-tilt]");
  if (!target) return;
  if (window.gsap) {
    const rotateX = gsap.quickTo(target, "rotationX", { duration: .45, ease: "power3.out" });
    const rotateY = gsap.quickTo(target, "rotationY", { duration: .45, ease: "power3.out" });
    target.addEventListener("pointermove", (event) => {
      const rect = target.getBoundingClientRect();
      rotateY(((event.clientX - rect.left) / rect.width - .5) * 4.5);
      rotateX(-((event.clientY - rect.top) / rect.height - .5) * 3.5);
    });
    target.addEventListener("pointerleave", () => { rotateX(0); rotateY(0); });
    return;
  }
  target.addEventListener("pointermove", (event) => {
    const rect = target.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    target.style.transform = `perspective(1200px) rotateX(${-y * 2.5}deg) rotateY(${x * 3.5}deg)`;
  });
  target.addEventListener("pointerleave", () => { target.style.transform = ""; });
}

function initMagneticButtons() {
  if (!finePointer || reducedMotion || !window.gsap) return;
  document.querySelectorAll(".button, .dock-cta").forEach((button) => {
    const moveX = gsap.quickTo(button, "x", { duration: .35, ease: "power3.out" });
    const moveY = gsap.quickTo(button, "y", { duration: .35, ease: "power3.out" });
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      moveX((event.clientX - rect.left - rect.width / 2) * .12);
      moveY((event.clientY - rect.top - rect.height / 2) * .16);
    });
    button.addEventListener("pointerleave", () => { moveX(0); moveY(0); });
  });
}

function initActiveNavigation() {
  const links = [...document.querySelectorAll("[data-section-link]")];
  const sections = [...document.querySelectorAll("[data-section]")];
  if (!sections.length) return;
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const sectionId = entry.target.dataset.section;
      links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${sectionId}`));
      const index = sections.indexOf(entry.target);
      document.documentElement.style.setProperty("--rail-progress", sections.length > 1 ? index / (sections.length - 1) : 0);
    });
  }, { rootMargin: "-42% 0px -42%", threshold: 0 });
  sections.forEach((section) => observer.observe(section));
}

function initMotion() {
  if (!window.gsap || !window.ScrollTrigger) return;
  document.documentElement.classList.remove("motion-fallback");
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();

  media.add({
    desktop: "(min-width: 721px)",
    mobile: "(max-width: 720px)",
    reduceMotion: "(prefers-reduced-motion: reduce)"
  }, (context) => {
    const { desktop, reduceMotion: shouldReduce } = context.conditions;
    if (shouldReduce) return;

    const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .addLabel("copy")
      .from(".release-pill", { autoAlpha: 0, y: 16, duration: .45 }, "copy")
      .from(".hero h1", { autoAlpha: 0, y: 60, filter: "blur(12px)", duration: .92 }, "copy+=.12")
      .from(".hero-lead", { autoAlpha: 0, y: 24, duration: .56 }, "copy+=.42")
      .from(".hero-actions .button", { autoAlpha: 0, y: 18, stagger: .08, duration: .48 }, "copy+=.52")
      .from(".hero-tags span", { autoAlpha: 0, y: 12, stagger: .055, duration: .36 }, "copy+=.65")
      .addLabel("product", .18)
      .from(".hero-product", { autoAlpha: 0, x: desktop ? 80 : 0, y: desktop ? 0 : 35, scale: .955, duration: 1.05 }, "product")
      .from(".window-bar > *", { autoAlpha: 0, y: -8, stagger: .08, duration: .35 }, "product+=.55")
      .from(".floating-chip", { autoAlpha: 0, scale: .8, y: 14, stagger: .12, duration: .46 }, "product+=.72");

    gsap.to(".floating-chip", { y: -8, duration: 2.25, repeat: -1, yoyo: true, stagger: .48, ease: "sine.inOut" });

    const canvasLoop = gsap.timeline({ repeat: -1, repeatDelay: .35 });
    canvasLoop
      .addLabel("source")
      .to(".node-source", { scale: 1.055, y: -3, duration: .45, ease: "power2.out" }, "source")
      .to(".wire-flow", { strokeDashoffset: -56, duration: 2.5, ease: "none" }, "source")
      .to(".canvas-cursor", { x: 55, y: 45, duration: .9, ease: "power2.inOut" }, "source+=.18")
      .to(".node-source", { scale: 1, y: 0, duration: .35 }, "source+=.5")
      .to(".node-prompt", { scale: 1.055, y: -3, duration: .42, ease: "power2.out" }, "source+=.74")
      .to(".canvas-cursor", { x: 126, y: -14, duration: .85, ease: "power2.inOut" }, "source+=1.05")
      .to(".node-prompt", { scale: 1, y: 0, duration: .35 }, "source+=1.2")
      .to(".node-output", { scale: 1.06, y: -4, duration: .46, ease: "back.out(1.6)" }, "source+=1.55")
      .to(".canvas-cursor", { x: 183, y: 73, duration: .78, ease: "power2.inOut" }, "source+=1.85")
      .to(".node-output", { scale: 1, y: 0, duration: .35 }, "source+=2.12")
      .to(".node-asset", { scale: 1.06, duration: .42, ease: "back.out(1.7)" }, "source+=2.36")
      .to(".node-asset", { scale: 1, duration: .35 }, "source+=2.72")
      .to(".canvas-cursor", { x: 0, y: 0, autoAlpha: .35, duration: .55, ease: "power2.inOut" }, "source+=2.85")
      .set(".canvas-cursor", { autoAlpha: 1 });

    const closingLoops = [
      gsap.to(".logo-orbit-a", { rotation: "+=360", duration: 14, repeat: -1, ease: "none", paused: true }),
      gsap.to(".logo-orbit-b", { rotation: "-=360", duration: 19, repeat: -1, ease: "none", paused: true }),
      gsap.to(".logo-shell", { y: -7, rotation: 2.5, scale: 1.035, duration: 2.4, repeat: -1, yoyo: true, ease: "sine.inOut", paused: true }),
      gsap.fromTo(".logo-scan", { y: -32, autoAlpha: 0 }, { y: 32, autoAlpha: 1, duration: 1.8, repeat: -1, repeatDelay: 1.15, ease: "power2.inOut", paused: true }),
      gsap.to(".logo-glow", { scale: 1.15, autoAlpha: .52, duration: 2.8, repeat: -1, yoyo: true, ease: "sine.inOut", paused: true })
    ];
    const setClosingMotion = (method) => closingLoops.forEach((animation) => animation[method]());
    ScrollTrigger.create({
      trigger: ".closing",
      start: "top 82%",
      end: "bottom 18%",
      onEnter: () => setClosingMotion("play"),
      onEnterBack: () => setClosingMotion("play"),
      onLeave: () => setClosingMotion("pause"),
      onLeaveBack: () => setClosingMotion("pause")
    });

    if (desktop) {
      const heroParallax = gsap.timeline({
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: .9 }
      });
      heroParallax
        .to(".hero-copy", { yPercent: -13, autoAlpha: .35, ease: "none" }, 0)
        .to(".app-window", { yPercent: 13, scale: .965, ease: "none" }, 0)
        .to(".app-window > img", { yPercent: 5, scale: 1.08, ease: "none" }, 0)
        .to(".aurora-a", { yPercent: 38, xPercent: -12, ease: "none" }, 0)
        .to(".aurora-b", { yPercent: -28, xPercent: 16, ease: "none" }, 0)
        .to(".orbit-one", { rotation: 55, scale: 1.08, ease: "none" }, 0)
        .to(".orbit-two", { rotation: -42, scale: .9, ease: "none" }, 0);

      gsap.fromTo(".manifesto h2", { xPercent: -4 }, {
        xPercent: 4,
        ease: "none",
        scrollTrigger: { trigger: ".manifesto", start: "top bottom", end: "bottom top", scrub: 1.2 }
      });
      gsap.fromTo(".screen-frame img", { yPercent: -3, scale: 1.045 }, {
        yPercent: 3,
        scale: 1.09,
        ease: "none",
        scrollTrigger: { trigger: ".workflow-stage", start: "top bottom", end: "bottom top", scrub: 1 }
      });
      gsap.to(".data-vault", {
        yPercent: -10,
        rotation: 2.5,
        ease: "none",
        scrollTrigger: { trigger: ".local-first", start: "top bottom", end: "bottom top", scrub: 1.1 }
      });
      gsap.to(".closing-logo", {
        y: -22,
        rotation: -7,
        ease: "none",
        scrollTrigger: { trigger: ".closing", start: "top bottom", end: "center center", scrub: 1 }
      });
      gsap.fromTo(".bento", { y: 26 }, {
        y: -18,
        ease: "none",
        scrollTrigger: { trigger: ".capabilities", start: "top bottom", end: "bottom top", scrub: 1.1 }
      });
    }

    gsap.utils.toArray(".section-heading, .local-copy, .manifesto > p, .closing > span, .closing h2, .closing-actions").forEach((element) => {
      gsap.from(element, {
        autoAlpha: 0,
        y: 42,
        filter: "blur(7px)",
        duration: .82,
        ease: "power3.out",
        scrollTrigger: { trigger: element, start: "top 84%", once: true }
      });
    });

    gsap.from(".workflow-steps li", {
      autoAlpha: 0,
      x: desktop ? 35 : 0,
      y: desktop ? 0 : 24,
      stagger: .1,
      duration: .62,
      ease: "power3.out",
      scrollTrigger: { trigger: ".workflow-steps", start: "top 86%", once: true }
    });
    gsap.from(".screen-frame", {
      autoAlpha: 0,
      y: 36,
      scale: .97,
      duration: .88,
      ease: "power3.out",
      scrollTrigger: { trigger: ".screen-frame", start: "top 86%", once: true }
    });

    ScrollTrigger.batch(".bento-card, .roadmap-list article", {
      interval: .08,
      batchMax: desktop ? 4 : 2,
      start: "top 89%",
      once: true,
      onEnter: (batch) => gsap.from(batch, { autoAlpha: 0, y: 34, scale: .985, stagger: .075, duration: .62, ease: "power3.out", overwrite: "auto" })
    });
  });
}

initLocale();
initCursorGlow();
initProductTilt();
initMagneticButtons();
initActiveNavigation();
initMotion();

if (document.fonts?.ready) document.fonts.ready.then(() => window.ScrollTrigger?.refresh());
window.addEventListener("load", () => window.ScrollTrigger?.refresh(), { once: true });
