import { Pencil } from "lucide-react";

// `editable` rather than inferring it from `onChange`: a read-only banner
// still rendered the pencil badge and a clickable <label> that opened a file
// picker, because a label is interactive whether or not its input has a
// handler attached. Viewing someone else's profile offered to change their
// banner.
export default function Banner({ bannerUrl, onChange, editable = false }) {
  const style = bannerUrl ? { backgroundImage: `url(${bannerUrl})` } : undefined;

  if (!editable) {
    return <div className="banner" style={style} role="img" aria-label="Profile banner" />;
  }

  return (
    <label className="banner banner-editable" style={style}>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={onChange}
        aria-label="Change profile banner"
      />
      <span className="banner-edit-icon">
        <Pencil size={16} aria-hidden="true" />
      </span>
    </label>
  );
}
