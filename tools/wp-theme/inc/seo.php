<?php
/**
 * <title>・meta・OGP・JSON-LD
 *
 * 固定ページぶんは静的サイトの <head> をそのまま parts/{key}/head.php に持っている。
 * ここでは「投稿」と「相談室一覧」のように、中身が管理画面で変わるものだけを動的に出す。
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* <title>：静的サイトで決めた文言を優先する（全角 30〜32 文字以内に収めたもの） */
add_filter(
	'pre_get_document_title',
	function ( $title ) {
		if ( is_singular( 'post' ) ) {
			$seo = get_post_meta( get_queried_object_id(), '_linplan_seo_title', true );
			return $seo ? $seo : single_post_title( '', false ) . '｜ Linplan';
		}
		if ( is_category() || is_tag() ) {
			return single_term_title( '', false ) . '｜ 相談室 ｜ Linplan';
		}
		$key = linplan_part_key();
		if ( 'single' === $key && is_page() ) {
			return single_post_title( '', false ) . '｜ Linplan';
		}
		$titles = linplan_data( 'site' );
		return isset( $titles['titles'][ $key ] ) ? $titles['titles'][ $key ] : $title;
	}
);

/** OGP・JSON-LD 用の見出し（取り込んだ記事は静的サイトの headline。ページ上の h1 より長いことがある） */
function linplan_headline( $post ) {
	$headline = get_post_meta( $post->ID, '_linplan_headline', true );
	return '' !== (string) $headline ? $headline : get_the_title( $post );
}

/** 記事の説明文（meta description 用） */
function linplan_description( $post ) {
	$desc = get_post_meta( $post->ID, '_linplan_description', true );
	return '' !== (string) $desc ? $desc : wp_strip_all_tags( get_the_excerpt( $post ) );
}

function linplan_seo_head() {
	if ( is_singular( 'post' ) ) {
		linplan_seo_post( get_queried_object() );
	} elseif ( is_home() && ! is_front_page() ) {
		linplan_seo_blog();
	}
}

/** 投稿：meta description / OGP / Article JSON-LD（＋取り込んだ記事の FAQPage など） */
function linplan_seo_post( $post ) {
	$url      = get_permalink( $post );
	$title    = linplan_headline( $post );
	$desc     = linplan_description( $post );
	$og_desc  = get_post_meta( $post->ID, '_linplan_og_description', true );
	$og_image = get_post_meta( $post->ID, '_linplan_og_image', true );
	if ( ! $og_image ) {
		$og_image = has_post_thumbnail( $post ) ? get_the_post_thumbnail_url( $post, 'full' ) : get_theme_file_uri( 'assets/images/ogp.png' );
	}
	$og_image = linplan_fill( $og_image );
	?>
<meta name="description" content="<?php echo esc_attr( $desc ); ?>">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Linplan">
<meta property="og:title" content="<?php echo esc_attr( $title ); ?>">
<meta property="og:description" content="<?php echo esc_attr( $og_desc ? $og_desc : $desc ); ?>">
<meta property="og:url" content="<?php echo esc_url( $url ); ?>">
<meta property="og:image" content="<?php echo esc_url( $og_image ); ?>">
<meta name="twitter:card" content="summary_large_image">
	<?php
	$article = array(
		'@context'         => 'https://schema.org',
		'@type'            => 'Article',
		'headline'         => $title,
		'description'      => $og_desc ? $og_desc : $desc,
		'datePublished'    => get_the_date( 'Y-m-d', $post ),
		'dateModified'     => get_the_modified_date( 'Y-m-d', $post ),
		'author'           => array(
			'@type' => 'Person',
			'name'  => '坪山ちひろ',
			'url'   => home_url( '/about/' ),
		),
		'publisher'        => array(
			'@type' => 'Organization',
			'name'  => 'Linplan',
		),
		'mainEntityOfPage' => $url,
	);
	linplan_print_jsonld( $article );

	$extra = get_post_meta( $post->ID, '_linplan_jsonld', true );
	if ( is_array( $extra ) ) {
		foreach ( $extra as $json ) {
			$data = json_decode( linplan_fill( $json ), true );
			if ( is_array( $data ) ) {
				linplan_print_jsonld( $data );
			}
		}
	}
}

/** 相談室一覧：Blog JSON-LD（blogPost は公開中の全記事から作る） */
function linplan_seo_blog() {
	$site = linplan_data( 'site' );
	if ( empty( $site['blog_jsonld'] ) ) {
		return;
	}
	$blog = json_decode( linplan_fill( wp_json_encode( $site['blog_jsonld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ), true );
	if ( ! is_array( $blog ) ) {
		return;
	}
	$blog['blogPost'] = array();
	foreach ( get_posts( array( 'numberposts' => -1 ) ) as $post ) {
		$blog['blogPost'][] = array(
			'@type'         => 'BlogPosting',
			'headline'      => linplan_headline( $post ),
			'url'           => get_permalink( $post ),
			'datePublished' => get_the_date( 'Y-m-d', $post ),
		);
	}
	printf( '<link rel="canonical" href="%s">' . "\n", esc_url( home_url( '/blog/' ) ) );
	linplan_print_jsonld( $blog );
}

function linplan_print_jsonld( $data ) {
	echo '<script type="application/ld+json">' . "\n";
	echo wp_json_encode( $data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo "\n</script>\n";
}
