<?php
/**
 * テンプレート用ヘルパー
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** サイト内リンクを出力する（例：linplan_url( '/about/' )） */
function linplan_url( $path = '/' ) {
	echo esc_url( home_url( $path ) );
}

/** テーマ内アセットの URL を出力する（例：linplan_asset( 'images/profile.webp' )） */
function linplan_asset( $path ) {
	echo esc_url( get_theme_file_uri( 'assets/' . $path ) );
}

/** data/*.json を読む（リクエスト内でキャッシュ） */
function linplan_data( $name ) {
	static $cache = array();
	if ( ! isset( $cache[ $name ] ) ) {
		$file           = get_theme_file_path( 'data/' . $name . '.json' );
		$json           = is_readable( $file ) ? json_decode( file_get_contents( $file ), true ) : null; // phpcs:ignore WordPress.WP.AlternativeFunctions
		$cache[ $name ] = is_array( $json ) ? $json : array();
	}
	return $cache[ $name ];
}

/** {{home}} / {{theme}} を実際の URL に置き換える */
function linplan_fill( $text ) {
	return str_replace(
		array( '{{home}}', '{{theme}}' ),
		array( untrailingslashit( home_url() ), untrailingslashit( get_template_directory_uri() ) ),
		$text
	);
}

/**
 * いま表示しているページが使う parts/ のフォルダ名。
 * 固定ページは、取り込み時に付けたカスタムフィールド _linplan_part で決まる（スラッグを変えても崩れない）。
 * parts を持たない固定ページ（管理画面で新しく作ったページ）は、記事と同じ見た目（single）で本文を出す。
 */
function linplan_part_key() {
	if ( is_404() ) {
		return '404';
	}
	if ( is_front_page() ) {
		return 'index';
	}
	if ( is_page() ) {
		$key = get_post_meta( get_queried_object_id(), '_linplan_part', true );
		return $key ? $key : 'single';
	}
	if ( is_singular() ) {
		return 'single';
	}
	return 'blog';
}

/** parts/{key}/{name}.php を読み込む。無ければ false */
function linplan_part( $name ) {
	$file = get_theme_file_path( 'parts/' . linplan_part_key() . '/' . $name . '.php' );
	if ( ! is_readable( $file ) ) {
		return false;
	}
	include $file;
	return true;
}

/** PC ナビの「現在のページ」表示（静的サイトでは theme.js が付けていたもの） */
function linplan_current( $path ) {
	$current = false;
	if ( '/blog/' === $path ) {
		$current = ! is_front_page() && ( is_home() || is_singular( 'post' ) || is_archive() || is_search() );
	} elseif ( is_page() && ! is_front_page() ) {
		$current = trim( $path, '/' ) === get_page_uri( get_queried_object_id() );
	}
	if ( $current ) {
		echo ' class="is-current" aria-current="page"';
	}
}

/* ------------------------------------------------------------
 * 相談室（ブログ）
 * ---------------------------------------------------------- */

/** 記事の主カテゴリ */
function linplan_category( $post = null ) {
	$cats = get_the_category( get_post( $post )->ID );
	return $cats ? $cats[0] : null;
}

/** カテゴリの表示名。取り込んだ記事は静的サイトの表記（meta）を優先する */
function linplan_cat_label( $post, $meta_key ) {
	$post  = get_post( $post );
	$label = get_post_meta( $post->ID, $meta_key, true );
	if ( '' === (string) $label ) {
		$cat   = linplan_category( $post );
		$label = $cat ? $cat->name : '';
	}
	return $label;
}

/** 読了時間（分）。meta が無い記事は本文の文字数から概算する */
function linplan_minutes( $post = null ) {
	$post    = get_post( $post );
	$minutes = (int) get_post_meta( $post->ID, '_linplan_minutes', true );
	if ( $minutes < 1 ) {
		$minutes = max( 1, (int) ceil( mb_strlen( wp_strip_all_tags( $post->post_content ) ) / 500 ) );
	}
	return $minutes;
}

/** カード用の見出し（静的サイトのカードは記事タイトルより短いことがある） */
function linplan_card_title( $post ) {
	$title = get_post_meta( $post->ID, '_linplan_card_title', true );
	return '' !== (string) $title ? $title : get_the_title( $post );
}

/** カードのサムネイルに載せる短いラベル */
function linplan_card_label( $post ) {
	$label = get_post_meta( $post->ID, '_linplan_label', true );
	if ( '' === (string) $label ) {
		$title = get_the_title( $post );
		$label = mb_strlen( $title ) > 15 ? mb_substr( $title, 0, 15 ) . '…' : $title;
	}
	return $label;
}

/** 相談室一覧のカテゴリ絞り込みボタン */
function linplan_cat_chips() {
	echo '<button type="button" class="blog-cat is-active" data-filter="all" aria-pressed="true">すべて</button>' . "\n";
	foreach ( get_categories( array( 'orderby' => 'term_id' ) ) as $cat ) {
		printf(
			'        <button type="button" class="blog-cat" data-filter="%s" aria-pressed="false">%s</button>' . "\n",
			esc_attr( $cat->slug ),
			esc_html( $cat->name )
		);
	}
}

/** 相談室一覧のカード（メインクエリを回す） */
function linplan_post_cards() {
	while ( have_posts() ) {
		the_post();
		$post  = get_post();
		$cat   = linplan_category( $post );
		$thumb = get_post_meta( $post->ID, '_linplan_card_thumb', true );
		$photo = (bool) get_post_meta( $post->ID, '_linplan_card_photo', true );
		if ( '' === (string) $thumb ) {
			$thumb = '<span class="post-card__cat">' . esc_html( linplan_cat_label( $post, '_linplan_card_cat' ) ) . '</span>';
			if ( has_post_thumbnail( $post ) ) {
				$photo  = true;
				$thumb .= get_the_post_thumbnail( $post, 'medium_large', array( 'alt' => '' ) );
			} else {
				$thumb .= '<span>' . esc_html( linplan_card_label( $post ) ) . '</span>';
			}
		}
		?>
      <a href="<?php the_permalink(); ?>" class="post-card<?php echo is_sticky() ? ' post-card--featured' : ''; ?>" data-cat="<?php echo esc_attr( $cat ? $cat->slug : '' ); ?>">
        <div class="post-card__thumb<?php echo $photo ? ' post-card__thumb--photo' : ''; ?>"><?php echo $thumb; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div>
        <div class="post-card__body">
          <h2 class="post-card__title"><?php echo esc_html( linplan_card_title( $post ) ); ?></h2>
          <p class="post-card__excerpt"><?php echo esc_html( get_the_excerpt() ); ?></p>
          <div class="post-card__meta"><span class="post-card__meta-dates"><span><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></span><span>約<?php echo (int) linplan_minutes( $post ); ?>分</span></span><span class="post-card__more">続きを読む →</span></div>
        </div>
      </a>
		<?php
	}
	wp_reset_postdata();
}

/**
 * シンプルなカード（トップの相談室セクション／記事末の「あわせて読みたい」）
 *
 * @param WP_Post[] $posts        記事
 * @param bool      $with_excerpt 抜粋を出すか
 * @param bool      $reveal       リビール用クラス（reveal / reveal-d1 / reveal-d2）を付けるか
 */
function linplan_simple_cards( $posts, $with_excerpt, $reveal ) {
	foreach ( array_values( $posts ) as $i => $post ) {
		$class = 'post-card';
		if ( $reveal ) {
			$class .= ' reveal' . ( $i % 3 ? ' reveal-d' . ( $i % 3 ) : '' );
		}
		?>
      <a href="<?php echo esc_url( get_permalink( $post ) ); ?>" class="<?php echo esc_attr( $class ); ?>">
        <div class="post-card__thumb"><span class="post-card__cat"><?php echo esc_html( linplan_cat_label( $post, '_linplan_card_cat' ) ); ?></span><span><?php echo esc_html( linplan_card_label( $post ) ); ?></span></div>
        <div class="post-card__body">
          <h3 class="post-card__title"><?php echo esc_html( linplan_card_title( $post ) ); ?></h3>
<?php if ( $with_excerpt ) : ?>
          <p class="post-card__excerpt"><?php echo esc_html( get_the_excerpt( $post ) ); ?></p>
<?php endif; ?>
          <div class="post-card__meta"><span><?php echo esc_html( get_the_date( 'Y.m.d', $post ) ); ?></span><span>約<?php echo (int) linplan_minutes( $post ); ?>分</span></div>
        </div>
      </a>
		<?php
	}
}

/** トップの相談室セクション：新しい順に 3 件 */
function linplan_home_cards() {
	$posts = get_posts(
		array(
			'numberposts'         => 3,
			'ignore_sticky_posts' => true,
		)
	);
	linplan_simple_cards( $posts, true, true );
}

/** 記事末の関連記事。取り込んだ記事は静的サイトと同じ 3 本、新しい記事は同じカテゴリの新着 */
function linplan_related_posts( $post ) {
	$slugs = get_post_meta( $post->ID, '_linplan_related', true );
	if ( is_array( $slugs ) && $slugs ) {
		$posts = get_posts(
			array(
				'post_name__in' => $slugs,
				'orderby'       => 'post_name__in',
				'numberposts'   => count( $slugs ),
			)
		);
		if ( $posts ) {
			return $posts;
		}
	}
	$cat   = linplan_category( $post );
	$posts = get_posts(
		array(
			'numberposts' => 3,
			'exclude'     => array( $post->ID ),
			'category'    => $cat ? $cat->term_id : 0,
		)
	);
	if ( count( $posts ) < 3 ) {
		$posts = array_merge(
			$posts,
			get_posts(
				array(
					'numberposts' => 3 - count( $posts ),
					'exclude'     => array_merge( array( $post->ID ), wp_list_pluck( $posts, 'ID' ) ),
				)
			)
		);
	}
	return $posts;
}
