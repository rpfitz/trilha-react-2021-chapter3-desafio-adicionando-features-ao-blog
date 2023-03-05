import Prismic from '@prismicio/client';
import { format } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { RichText } from 'prismic-dom';
import { FiCalendar, FiClock, FiUser } from 'react-icons/fi';
import Comments from '../../components/Comments';
import Header from '../../components/Header';
import { getPrismicClient } from '../../services/prismic';
import styles from './post.module.scss';
import commonStyles from '../../styles/common.module.scss';

interface Post {
  uid: string;
  first_publication_date: string | null;
  last_publication_date: string | null;
  data: {
    title: string;
    banner: {
      url: string;
      alt: string;
    };
    author: string;
    content: {
      heading: string;
      body: {
        text: string;
      }[];
    }[];
  };
}

interface PostProps {
  post: Post;
  preview: boolean;
  nextPost: Post | null;
  prevPost: Post | null;
}

export default function Post({
  post,
  preview,
  nextPost,
  prevPost,
}: PostProps): JSX.Element {
  const { isFallback } = useRouter();

  if (isFallback) {
    return <h1>Carregando...</h1>;
  }

  function getReadingTime(): number {
    const content = post.data.content.reduce((words, postContent) => {
      // eslint-disable-next-line no-param-reassign
      words += `${postContent.heading} `;
      // eslint-disable-next-line no-param-reassign
      words += RichText.asText(postContent.body);
      return words;
    }, '');

    const wordCount = content.split(/\s/).length;

    return Math.ceil(wordCount / 200);
  }

  function isEdited(): boolean {
    return post.first_publication_date !== post.last_publication_date;
  }

  return (
    <>
      <Head>
        <title>{post.data.title} | spacetraveling</title>
      </Head>
      <Header />
      <div className={styles.container}>
        <img src={post.data.banner.url} alt={post.data.banner.alt} />
        <div className={styles.post}>
          <h1>{post.data.title}</h1>
          <time>
            <FiClock />{' '}
            {format(new Date(post.first_publication_date), 'dd MMM yyyy', {
              locale: ptBR,
            })}
          </time>
          <span>
            <FiUser /> {post.data.author}
          </span>
          <time>
            <FiCalendar /> {`${getReadingTime()} min`}
          </time>
          {isEdited() && (
            <p className={styles.editedDate}>
              * editado em{' '}
              {format(
                new Date(post.last_publication_date),
                "dd MMM yyyy', às' HH:mm",
                {
                  locale: ptBR,
                }
              )}
              .
            </p>
          )}
          {post.data.content.map(session => (
            <div className={styles.session} key={session.heading}>
              <h2>{session.heading}</h2>
              <div
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{
                  __html: RichText.asHtml(session.body),
                }}
              />
            </div>
          ))}
          <hr />
          <div className={styles.navigation}>
            {prevPost && (
              <Link href={`/post/${prevPost.uid}`}>
                <a className={styles.prevPost}>
                  <p>{prevPost.data.title}</p>
                  <span>Post anterior</span>
                </a>
              </Link>
            )}
            {nextPost && (
              <Link href={`/post/${nextPost.uid}`}>
                <a className={styles.nextPost}>
                  <p>{nextPost.data.title}</p>
                  <span>Próximo post</span>
                </a>
              </Link>
            )}
          </div>
          <Comments />
          {preview && (
            <div className={commonStyles.exitPreviewButton}>
              <Link href="/api/exit-preview">
                <a>Sair do modo preview</a>
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export const getStaticPaths: GetStaticPaths = async () => {
  const prismic = getPrismicClient();
  const posts = await prismic.query(
    [Prismic.Predicates.at('document.type', 'posts')],
    { pageSize: 5, fetch: ['posts.uid'] }
  );

  const paths = posts.results.map(post => ({ params: { slug: post.uid } }));

  return {
    paths,
    fallback: 'blocking',
  };
};

export const getStaticProps: GetStaticProps = async ({
  params,
  preview = false,
  previewData,
}) => {
  const { slug } = params;

  const prismic = getPrismicClient();
  const response = await prismic.getByUID('post', String(slug), {
    ref: previewData?.ref ?? null,
  });

  const nextPost = await prismic.query(
    Prismic.Predicates.at('document.type', 'post'),
    {
      fetch: ['post.title', 'post.subtitle', 'post.author'],
      pageSize: 1,
      orderings: '[document.first_publication_date]',
      ref: previewData?.ref ?? null,
      after: response.id,
    }
  );

  const prevPost = await prismic.query(
    Prismic.Predicates.at('document.type', 'post'),
    {
      fetch: ['post.title', 'post.subtitle', 'post.author'],
      pageSize: 1,
      orderings: '[document.first_publication_date desc]',
      ref: previewData?.ref ?? null,
      after: response.id,
    }
  );

  return {
    props: {
      post: response,
      preview,
      nextPost: nextPost.results[0] ?? null,
      prevPost: prevPost.results[0] ?? null,
    },
    redirect: 60 * 30, // 30 minutos
  };
};
