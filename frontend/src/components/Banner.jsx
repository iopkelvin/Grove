export default function Banner() {
  return (
    <label className="banner">
      <input type="file" accept="image/*" hidden />
      <span className="banner-edit-icon">✎</span>
    </label>
  );
}