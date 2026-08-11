(() => {
  const legacy = document.createElement("script");
  legacy.src = "/site-assets-r6/site.js";
  document.head.append(legacy);

  const loader = document.querySelector("[data-identity-loader]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let introTimeline = null;
  let safetyTimer = null;
  const finishLoader = () => {
    if (!loader || loader.classList.contains("is-done")) return;
    if (safetyTimer) window.clearTimeout(safetyTimer);
    loader.classList.add("is-done");
    loader.style.removeProperty("opacity");
    loader.style.removeProperty("visibility");
    document.body.classList.remove("intro-active");
    try { window.sessionStorage.setItem("tz-geo-identity-intro", "seen"); } catch {}
  };
  const loadGsap = () => new Promise((resolve) => {
    if (window.gsap) return resolve(window.gsap);
    const script = document.createElement("script");
    script.src = "/site-assets-r9/gsap.min.js?v=20260810-passport8";
    script.onload = () => resolve(window.gsap || null);
    script.onerror = () => resolve(null);
    document.head.append(script);
  });
  const runIntro = async () => {
    if (!loader) return;
    const seen = (() => { try { return window.sessionStorage.getItem("tz-geo-identity-intro") === "seen"; } catch { return false; } })();
    const forceIntro = new URLSearchParams(window.location.search).has("intro");
    if (reduceMotion) return finishLoader();
    if (seen && !forceIntro) return finishLoader();
    document.body.classList.add("intro-active");
    loader.querySelector("[data-loader-skip]")?.addEventListener("click", () => {
      introTimeline?.kill();
      finishLoader();
    }, { once: true });
    safetyTimer = window.setTimeout(() => { introTimeline?.kill(); finishLoader(); }, 4800);
    const gsap = await loadGsap();
    if (!gsap) {
      loader.classList.add("is-fallback");
      window.setTimeout(finishLoader, 1100);
      return;
    }
    const graph = loader.querySelector("[data-obsidian-graph]");
    const aura = loader.querySelector(".obsidian-graph-aura");
    const loaderLines = loader.querySelectorAll("[data-loader-line]");
    const coreNode = loader.querySelector("[data-loader-node][data-depth='0']");
    const primaryLines = loader.querySelectorAll("[data-loader-line][data-depth='1']");
    const primaryNodes = loader.querySelectorAll("[data-loader-node][data-depth='1']");
    const clusterLines = loader.querySelectorAll("[data-loader-line][data-depth='2']");
    const clusterNodes = loader.querySelectorAll("[data-loader-node][data-depth='2']");
    const crossLines = loader.querySelectorAll("[data-loader-line][data-depth='3']");
    const loaderNodes = loader.querySelectorAll("[data-loader-node]");
    const status = loader.querySelector("[data-loader-status]");
    const setStatus = (copy) => { if (status) status.textContent = copy; };
    loaderLines.forEach((line) => {
      const length = typeof line.getTotalLength === "function" ? line.getTotalLength() : 420;
      gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
    });
    // Treat the relationship graph as one camera plane. Keeping the depth on
    // the container gives the loader a convincing 3D read without creating a
    // separate perpetual tween for every node.
    gsap.set(graph, {
      transformPerspective: 1400,
      transformOrigin: "50% 50% 0px",
      perspectiveOrigin: "50% 44%",
      force3D: true
    });
    gsap.set(loaderNodes, { autoAlpha: 0, scale: .25, transformOrigin: "center center" });
    gsap.set(aura, { autoAlpha: 0, scale: .52, transformOrigin: "center center" });
    gsap.set(aura, { z: -34, force3D: true });
    gsap.set(coreNode, { z: 42, force3D: true });
    gsap.set(primaryNodes, { z: 18, force3D: true });
    gsap.set(clusterNodes, { z: -10, force3D: true });
    introTimeline = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: finishLoader
    });
    introTimeline
      .set(loader, { autoAlpha: 1, visibility: "visible" })
      .addLabel("focus")
      .fromTo(
        graph,
        {
          autoAlpha: 0,
          y: 36,
          z: -220,
          scale: .64,
          rotationX: 64,
          rotationY: -26,
          rotationZ: -6
        },
        {
          autoAlpha: 1,
          y: 0,
          z: 0,
          scale: 1,
          rotationX: 7,
          rotationY: 0,
          rotationZ: 0,
          duration: .88,
          ease: "power4.out",
          force3D: true
        },
        "focus"
      )
      .to(aura, { autoAlpha: 1, scale: 1, duration: .68, ease: "power2.out" }, "focus+=.12")
      .to(coreNode, { autoAlpha: 1, scale: 1, duration: .42 }, "focus+=.22")
      .call(() => setStatus("正在识别企业主体"), null, "focus+=.3")
      .addLabel("branches", "focus+=.58")
      .to(primaryLines, { strokeDashoffset: 0, duration: .62, stagger: .075, ease: "power2.inOut" }, "branches")
      .to(primaryNodes, { autoAlpha: 1, scale: 1, duration: .34, stagger: .075 }, "branches+=.13")
      .call(() => setStatus("正在建立企业核心关系"), null, "branches+=.25")
      .addLabel("clusters", "branches+=.66")
      .to(clusterLines, { strokeDashoffset: 0, duration: .54, stagger: .035, ease: "power2.inOut" }, "clusters")
      .to(clusterNodes, { autoAlpha: 1, scale: 1, duration: .3, stagger: { amount: .48, from: "start" } }, "clusters+=.1")
      .call(() => setStatus("正在连接客户问题与公开信源"), null, "clusters+=.24")
      .addLabel("connections", "clusters+=.7")
      .to(crossLines, { strokeDashoffset: 0, duration: .58, stagger: .08, ease: "power2.inOut" }, "connections")
      .call(() => setStatus("企业公开关系图谱已建立"), null, "connections+=1.04")
      .to(graph, { scale: 1.025, z: 20, rotationX: 2, rotationY: 3, rotationZ: .35, duration: .48, ease: "power2.inOut", force3D: true }, "connections+=1.05")
      .addLabel("exit", "connections+=1.42")
      .to(loader, { autoAlpha: 0, duration: .58, ease: "power2.inOut" }, "exit");
  };
  void runIntro();

  const dossier = document.querySelector(".passport-dossier");
  if (!dossier) return;
  const hero = dossier.closest(".passport-hero");
  const seal = () => dossier.classList.add("is-sealed");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      seal();
      observer.disconnect();
    }, { threshold: .35 });
    observer.observe(dossier);
  } else seal();

  if (!reduceMotion && window.matchMedia("(pointer:fine)").matches) {
    hero?.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - .5) * 2));
      const y = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - .5) * 2));
      dossier.style.setProperty("--passport-tilt-x", `${x * 2.3}deg`);
      dossier.style.setProperty("--passport-tilt-y", `${y * -1.6}deg`);
    });
    hero?.addEventListener("pointerleave", () => {
      dossier.style.setProperty("--passport-tilt-x", "0deg");
      dossier.style.setProperty("--passport-tilt-y", "0deg");
    });
  }
})();
