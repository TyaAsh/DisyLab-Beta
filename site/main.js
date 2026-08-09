gsap.registerPlugin(ScrollTrigger);

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function initHeroEntrance() {
  if (reducedMotion) return;
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  timeline
    .from(".eyebrow", { opacity: 0, y: 18, duration: 0.55 })
    .from(".hero h1", { opacity: 0, y: 55, filter: "blur(12px)", duration: 0.9 }, "-=.3")
    .from(".hero-lead, .hero-actions, .hero-notes", { opacity: 0, y: 22, stagger: 0.11, duration: 0.55 }, "-=.45")
    .from(".demo-stage", { opacity: 0, x: 70, rotateY: 7, duration: 1 }, "-=.85")
    .from(".demo-node", { opacity: 0, scale: .86, stagger: .12, duration: .55 }, "-=.6")
    .from(".demo-agent", { opacity: 0, y: 18, scale: .9, duration: .45 }, "-=.25");
}

function initParallax() {
  if (reducedMotion) return;
  gsap.to(".orb-one", {
    yPercent: 38,
    xPercent: -12,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".orb-two", {
    yPercent: -28,
    xPercent: 16,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });
  gsap.to(".demo-stage", {
    y: -62,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 }
  });
}

function initSectionReveals() {
  if (reducedMotion) return;
  gsap.utils.toArray(".section-heading, .statement").forEach((element) => {
    gsap.from(element, {
      opacity: 0,
      y: 45,
      filter: "blur(8px)",
      duration: .85,
      ease: "power3.out",
      scrollTrigger: { trigger: element, start: "top 82%", once: true }
    });
  });
  gsap.utils.toArray(".feature-grid article, .roadmap-track article").forEach((element, index) => {
    gsap.from(element, {
      opacity: 0,
      y: 34,
      duration: .58,
      delay: (index % 4) * .07,
      ease: "power3.out",
      scrollTrigger: { trigger: element, start: "top 88%", once: true }
    });
  });
  gsap.utils.toArray(".screenshot-shell, .preset-feature").forEach((element) => {
    gsap.from(element, {
      opacity: 0,
      scale: .96,
      y: 38,
      duration: .9,
      ease: "power3.out",
      scrollTrigger: { trigger: element, start: "top 86%", once: true }
    });
  });
}

function initMagneticPill() {
  if (reducedMotion || !window.matchMedia("(pointer:fine)").matches) return;
  const pill = document.querySelector(".pill-nav");
  document.addEventListener("mousemove", (event) => {
    const rect = pill.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    if (distance < 140) {
      const pull = 1 - distance / 140;
      gsap.to(pill, { x: dx * pull * .12, y: dy * pull * .15, duration: .35, ease: "power2.out" });
    } else {
      gsap.to(pill, { x: 0, y: 0, duration: .7, ease: "elastic.out(1, .5)" });
    }
  });
}

function initDemoPulse() {
  if (reducedMotion) return;
  gsap.to(".result-glow", { scale: 1.35, opacity: .55, duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
  gsap.to(".demo-canvas path", { strokeDashoffset: -28, duration: 2.4, repeat: -1, ease: "none" });
}

initHeroEntrance();
initParallax();
initSectionReveals();
initMagneticPill();
initDemoPulse();

document.fonts.ready.then(() => ScrollTrigger.refresh());
