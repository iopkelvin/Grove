export default function ProfilePicture() {
  return (
    <label className="profile-picture">
      <input type="file" accept="image/*" hidden />
      <span className="profile-picture-edit-icon">✎</span>
    </label>
  );
}