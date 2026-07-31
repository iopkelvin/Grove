export default function Banner({ bannerUrl, onChange }) {
  return (
    <label
      className="banner"
      style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
    >
      <input type="file" accept="image/*" hidden onChange={onChange} />
      <span className="banner-edit-icon">✎</span>
    </label>
  );
}