export default function ProfileBanner() {
  return (
    <label className="profile-banner">
      <input type="file" accept="image/*" hidden />
      <span>Click to upload banner</span>
    </label>
  );
}