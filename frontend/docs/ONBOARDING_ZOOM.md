# Onboarding zoom — implementation choice

**Chosen approach:** Animate a wrapper `motion.div` around the onboarding SVG using **scale** (0.42 → 1) and **translateY** (positive offset → 0) with **ease-out** cubic-bezier `[0.25, 0.1, 0.25, 1]` over **1000ms**.

**Why not animated `viewBox`?** Interpolating four `viewBox` numbers works in some setups but is brittle across browsers and Framer Motion attribute typing; scale + translate gives a predictable “camera pushes in” feel with the same calm motion language.

**Rules:** No spring physics; skip link and primary CTA both call `markOnboardingComplete()` then navigate to `/`.
