const CHARACTER_STATES = new Set(["idle", "working", "talking", "serving", "celebrating"]);
const STATE_CLASSES = [...CHARACTER_STATES].map((state) => `character-state--${state}`);
const CHARACTER_CLASSES = [...STATE_CLASSES, "character-state--transient"];

const activeStates = new Map();
const pauseReasons = new Set();
let initialized = false;

function updatePausedClass() {
  if (document.hidden) pauseReasons.add("visibility");
  else pauseReasons.delete("visibility");
  document.documentElement.classList.toggle("game-animations-paused", pauseReasons.size > 0);
}

function getCharacters(id) {
  return [...document.querySelectorAll(".character-avatar[data-character-id]")]
    .filter((element) => element.dataset.characterId === id);
}

function applyCharacterStateToElement(element, state, current) {
    element.classList.remove(...CHARACTER_CLASSES);
    element.classList.add(`character-state--${state}`);
    if (current?.transient) element.classList.add("character-state--transient");
    element.dataset.characterState = state;
}

function applyCharacterState(id, state) {
  const current = activeStates.get(id);
  for (const element of getCharacters(id)) {
    applyCharacterStateToElement(element, state, current);
  }
}

function handleAnimationEnd(event) {
  if (!["working", "serving", "talking", "celebrating"].includes(event.animationName)) return;
  const character = event.target.closest?.(".character-avatar[data-character-id]");
  if (!character) return;
  const id = character.dataset.characterId;
  const current = activeStates.get(id);
  if (current?.transient && current.state === event.animationName) {
    setCharacterState(id, "idle", { force: true });
  }
}

function handleVisibilityChange() {
  updatePausedClass();
}

export function initAnimationController() {
  if (initialized) return;
  initialized = true;
  document.addEventListener("visibilitychange", handleVisibilityChange);
  document.addEventListener("animationend", handleAnimationEnd, true);
  updatePausedClass();
}

export function setCharacterState(id, state, options = {}) {
  if (!id || !CHARACTER_STATES.has(state)) return false;

  const current = activeStates.get(id);
  if (state === "idle" && current?.transient && !options.force) return false;

  const transient = Boolean(options.transient);
  if (current?.state === state && current.transient === transient) {
    for (const element of getCharacters(id)) {
      if (element.dataset.characterState !== state || !element.classList.contains(`character-state--${state}`)) {
        applyCharacterStateToElement(element, state, current);
      }
    }
    return true;
  }

  activeStates.set(id, { state, transient });
  applyCharacterState(id, state);
  return true;
}

export function pauseAnimations(reason = "manual") {
  pauseReasons.add(reason);
  updatePausedClass();
}

export function resumeAnimations(reason = "manual") {
  pauseReasons.delete(reason);
  updatePausedClass();
}

export function destroyAnimationController() {
  if (initialized) {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.removeEventListener("animationend", handleAnimationEnd, true);
  }
  initialized = false;
  pauseReasons.clear();
  document.documentElement.classList.remove("game-animations-paused");
  for (const id of activeStates.keys()) {
    for (const element of getCharacters(id)) {
      element.classList.remove(...CHARACTER_CLASSES);
      delete element.dataset.characterState;
    }
  }
  activeStates.clear();
}