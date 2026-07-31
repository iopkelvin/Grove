import { Pencil } from "lucide-react";

export default function Banner({ bannerUrl, onChange }) {
  return (
    <label
      className={onChange ? "banner banner-editable" : "banner"}
      style={bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined}
    >
      {onChange && (
        <>
          <input type="file" accept="image/*" hidden onChange={onChange} />
          <span className="banner-edit-icon">
            <Pencil size={16} />
          </span>
        </>
      )}
    </label>
  );
}