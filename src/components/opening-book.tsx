/** Decorative open book. Two leaves take turns flipping so the loading screen stays light. */
export function OpeningBook() {
  return (
    <div className="opening-book" aria-hidden="true">
      <div className="opening-book-scene">
        <div className="opening-book-page opening-book-page-left" />
        <div className="opening-book-page opening-book-page-right">
          <span className="opening-book-leaf">
            <span className="opening-book-face opening-book-face-front" />
            <span className="opening-book-face opening-book-face-back" />
          </span>
          <span className="opening-book-leaf opening-book-leaf-next">
            <span className="opening-book-face opening-book-face-front" />
            <span className="opening-book-face opening-book-face-back" />
          </span>
        </div>
        <span className="opening-book-edges" />
      </div>
    </div>
  )
}
