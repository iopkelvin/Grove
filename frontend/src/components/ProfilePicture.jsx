export default function ProfilePicture() {
  return (
    <label className="profile-picture">
      <input type="file" accept="image/*" hidden />
      <span>Upload photo</span>
    </label>
  );
}