import Link from "next/link";
import dateFormat from "dateformat";

const PostGrid = ({slug, title, excerpt, thumb, categories, author, date, comment}) => {
    return (
        <div className="tt-blog-thumb">
            <div className="tt-img">
                <Link href={`/blog/${slug}`}>
                    <img src={thumb} width="100%" alt={title}/>
                </Link>
            </div>

            <div className="tt-title-description">
                <div className="tt-background"/>
                <div className="tt-tag">
                    {categories.map((category, i) => <Link href={`/blog/${slug}`} key={i}>{category}</Link>)}
                </div>
                <div className="tt-title">
                    <Link href={`/blog/${slug}`}>{title}</Link>
                </div>
                <p>{excerpt}</p>
                <div className="tt-meta">
                    <div className="tt-author">
                        by <Link href={`/blog/${slug}`}>{author}</Link> on {dateFormat(date, 'mmmm dd, yyyy')}
                    </div>
                    <div className="tt-comments">
                        <Link href={`/blog/${slug}`}>
                            <i className="tt-icon icon-f-88"/>{comment ? comment : 0}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostGrid;