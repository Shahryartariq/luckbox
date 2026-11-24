// Sets the colour theme before first paint so dark mode never flashes light.
// Kept as a tiny external file because the Content-Security-Policy forbids inline scripts.
(function () {
  var root = document.documentElement;
  var choice = "system";
  try {
    var saved = localStorage.getItem("luckbox:theme");
    if (saved === "light" || saved === "dark") choice = saved;
  } catch {
    // Storage blocked: follow the system setting.
  }
  var dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.setAttribute("data-theme", dark ? "dark" : "light");
})();
