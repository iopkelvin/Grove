export default function FriendsCard({ friendsOnline = 0 }) {
  return <div className="card">{friendsOnline} Friends Online</div>;
}