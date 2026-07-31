export default function ProfilePicture({ avatarUrl }) {
  return (
    <label
      className="profile-picture"
      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
    >
      <input type="file" accept="image/*" hidden />
      <span className="profile-picture-edit-icon">✎</span>
    </label>
  );
}