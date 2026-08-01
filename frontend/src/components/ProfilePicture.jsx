import { Pencil } from "lucide-react";

// Falls back to the user's initial rather than an empty grey circle, so a
// profile with no photo still reads as a person. Same `editable` fix as
// Banner: the label was clickable on other people's profiles.
export default function ProfilePicture({ avatarUrl, username, onChange, editable = false }) {
  const style = avatarUrl
    ? {
        backgroundImage: `url(${avatarUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const initial = (username || "?")[0].toUpperCase();
  const placeholder = !avatarUrl && <span className="profile-picture-initial">{initial}</span>;

  if (!editable) {
    return (
      <div
        className="profile-picture"
        style={style}
        role="img"
        aria-label={username ? `${username}'s profile picture` : "Profile picture"}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <label className="profile-picture profile-picture-editable" style={style}>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={onChange}
        aria-label="Change profile picture"
      />
      {placeholder}
      <span className="profile-picture-edit-icon">
        <Pencil size={16} aria-hidden="true" />
      </span>
    </label>
  );
}
