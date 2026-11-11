document.addEventListener("DOMContentLoaded", () => {

    const revealElements =
        document.querySelectorAll(".reveal");

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (
        "IntersectionObserver" in window &&
        !reducedMotion
    ) {
        const revealObserver = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");
                    } else {
                        entry.target.classList.remove("visible");
                    }
                });
            },
            {
                threshold: 0.1,
                rootMargin: "0px 0px -8% 0px"
            }
        );

        revealElements.forEach((element) => {
            element.classList.add("reveal-ready");
            revealObserver.observe(element);
        });
    } else {
        revealElements.forEach((element) => {
            element.classList.add("visible");
        });
    }

    const navLinks =
        document.querySelectorAll(".nav-link");

    const pageSections =
        document.querySelectorAll("main > section[id]");

    const updateActiveNavigation = () => {
        const marker = window.innerHeight * 0.35;

        let activeSection = "home";

        pageSections.forEach((section) => {
            const rect = section.getBoundingClientRect();

            if (
                rect.top <= marker &&
                rect.bottom > marker
            ) {
                activeSection = section.id;
            }
        });

        navLinks.forEach((link) => {
            const target = link.getAttribute("href");

            const isActive =
                target === "#" + activeSection;

            link.classList.toggle("active", isActive);

            if (isActive) {
                link.setAttribute("aria-current", "location");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    };

    window.addEventListener(
        "scroll",
        updateActiveNavigation,
        { passive: true }
    );

    window.addEventListener(
        "resize",
        updateActiveNavigation
    );

    updateActiveNavigation();

});
