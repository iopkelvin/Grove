import { Pencil } from "lucide-react";

export default function Banner({ bannerUrl, onChange }) {
  return (
    <label
      className="banner"
      style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
    >
      <input type="file" accept="image/*" hidden onChange={onChange} />
      <span className="banner-edit-icon">
        <Pencil size={16} />
      </span>
    </label>
  );
}