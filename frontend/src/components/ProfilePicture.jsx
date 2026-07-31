import { Pencil, UserRound } from "lucide-react";

export default function ProfilePicture({ avatarUrl, onChange }) {
  return (
    <label
      className="profile-picture"
      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <input type="file" accept="image/*" hidden onChange={onChange} />
      {!avatarUrl && <UserRound className="profile-picture-placeholder-icon" />}
      <span className="profile-picture-edit-icon">
        <Pencil size={16} />
      </span>
    </label>
  );
}