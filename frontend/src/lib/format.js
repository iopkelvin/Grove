export function capitalize(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

export function firstNameOf(profile) {
  return capitalize(profile?.first_name) || "there";
}

export function displayNameOf(user) {
  return user.display_name || capitalize(user.username);
}
