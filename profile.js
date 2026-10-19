const PROFILE_NAME_KEY = "data-unicorn-profile-name";
const PROFILE_GRAPHS_KEY = "data-unicorn-saved-graphs";

const profileForm = document.getElementById("profile-form");
const displayNameInput = document.getElementById("display-name");
const profileStatus = document.getElementById("profile-status");

function loadProfile() {
  try {
    displayNameInput.value = localStorage.getItem(PROFILE_NAME_KEY) || "";
    const savedGraphs = JSON.parse(localStorage.getItem(PROFILE_GRAPHS_KEY) || "[]");
    if (!Array.isArray(savedGraphs)) {
      throw new TypeError("Saved graph storage must contain a list.");
    }
    document.getElementById("saved-graph-count").textContent = savedGraphs.length;
  } catch (error) {
    console.error("Unable to read profile data from browser storage.", error);
    profileStatus.textContent = "Could not load profile data. Browser storage may be unavailable or invalid.";
  }
}

profileForm.addEventListener("submit", event => {
  event.preventDefault();
  const displayName = displayNameInput.value.trim();

  try {
    if (displayName) {
      localStorage.setItem(PROFILE_NAME_KEY, displayName);
      profileStatus.textContent = "Your display name was saved in this browser.";
    } else {
      localStorage.removeItem(PROFILE_NAME_KEY);
      profileStatus.textContent = "Your display name was cleared.";
    }
  } catch (error) {
    console.error("Unable to save profile data in browser storage.", error);
    profileStatus.textContent = "Could not save your profile. Browser storage may be unavailable.";
  }
});

document.getElementById("clear-profile").addEventListener("click", () => {
  displayNameInput.value = "";
  try {
    localStorage.removeItem(PROFILE_NAME_KEY);
    profileStatus.textContent = "Your display name was cleared.";
  } catch (error) {
    console.error("Unable to clear profile data from browser storage.", error);
    profileStatus.textContent = "Could not clear your profile. Browser storage may be unavailable.";
  }
});

loadProfile();
