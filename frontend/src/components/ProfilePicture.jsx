import { Pencil, UserRound } from "lucide-react";

export default function ProfilePicture({ avatarUrl, onChange }) {
  return (
    <label
      className={onChange ? "profile-picture profile-picture-editable" : "profile-picture"}
      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      {!avatarUrl && <UserRound className="profile-picture-placeholder-icon" />}
      {onChange && (
        <>
          <input type="file" accept="image/*" hidden onChange={onChange} />
          <span className="profile-picture-edit-icon">
            <Pencil size={16} />
          </span>
        </>
      )}
    </label>
  );
}