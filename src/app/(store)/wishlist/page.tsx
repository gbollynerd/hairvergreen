import { WishlistView } from './wishlist-view';
export const metadata = { title: 'Wishlist', robots: { index: false } };
export default function Wishlist() {
  return (
    <div className="container-x py-12 md:py-16">
      <p className="eyebrow">Saved</p>
      <h1 className="display-2 mt-3">Your wishlist</h1>
      <WishlistView />
    </div>
  );
}
