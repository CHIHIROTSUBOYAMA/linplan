<?php
/**
 * Linplan テーマ
 *
 * 静的サイトの読込順（base.css → ページ固有のインライン <style> → theme.css）を
 * wp_head の優先度でそのまま再現する。
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'LINPLAN_VERSION', '1.0.0' );

require get_template_directory() . '/inc/helpers.php';
require get_template_directory() . '/inc/seo.php';
require get_template_directory() . '/inc/demo-import.php';

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'title-tag' );
		add_theme_support( 'post-thumbnails' );
		add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	}
);

/* 静的サイトと同じ文字をそのまま出す（引用符やダッシュを勝手に置き換えない） */
add_filter( 'run_wptexturize', '__return_false' );

/*
 * グループブロックの中に <div class="wp-block-group__inner-container"> を挟ませない。
 * クラシックテーマでは互換のために挟まれるが、記事本文の CSS（.post-body > p など）が直下の要素を前提にしている。
 */
remove_filter( 'render_block_core/group', 'wp_restore_group_inner_container', 10 );

/* 相談室の一覧は静的サイトと同じく全件を 1 ページに並べる（カテゴリの絞り込みは JS） */
add_action(
	'pre_get_posts',
	function ( $query ) {
		if ( ! is_admin() && $query->is_main_query() && ( $query->is_home() || $query->is_archive() || $query->is_search() ) ) {
			$query->set( 'posts_per_page', -1 );
		}
	}
);

/* body のクラスは最小限に（WordPress 標準の .home .page .blog などを CSS と衝突させない） */
add_filter(
	'body_class',
	function ( $classes ) {
		return array_values( array_intersect( $classes, array( 'admin-bar', 'logged-in', 'customize-support' ) ) );
	}
);

/* ---- <head>：フォント preload → base.css → ページ固有 → theme.css ---- */
add_action(
	'wp_head',
	function () {
		$fonts = array(
			'ZenKakuGothicNew-Regular',
			'ZenKakuGothicNew-Medium',
			'ZenKakuGothicNew-Bold',
			'KleeOne-Regular',
			'KleeOne-SemiBold',
		);
		foreach ( $fonts as $font ) {
			printf(
				'<link rel="preload" as="font" type="font/woff2" href="%s" crossorigin>' . "\n",
				esc_url( get_theme_file_uri( 'assets/fonts/' . $font . '.subset.woff2' ) )
			);
		}
		if ( ! has_site_icon() ) {
			printf( '<link rel="icon" href="%s" sizes="48x48 32x32 16x16">' . "\n", esc_url( get_theme_file_uri( 'assets/favicon.ico' ) ) );
			printf( '<link rel="icon" href="%s" type="image/svg+xml">' . "\n", esc_url( get_theme_file_uri( 'assets/favicon.svg' ) ) );
		}
	},
	1
);

add_action(
	'wp_enqueue_scripts',
	function () {
		/* ver を付けない：base.css 内の @font-face と preload の URL を一致させ、キャッシュも静的サイトと同じ扱いにする */
		wp_enqueue_style( 'linplan-base', get_theme_file_uri( 'assets/base.css' ), array(), null );
		wp_enqueue_script( 'linplan-theme', get_theme_file_uri( 'assets/theme.js' ), array(), null, true );
	}
);

add_action(
	'wp_head',
	function () {
		linplan_seo_head();
		linplan_part( 'head' );
		if ( is_singular( 'post' ) ) {
			$css = get_post_meta( get_queried_object_id(), '_linplan_css', true );
			if ( $css ) {
				echo "<style>\n" . $css . "\n</style>\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			}
		}
	},
	20
);

add_action(
	'wp_head',
	function () {
		printf( '<link rel="stylesheet" id="linplan-theme-css" href="%s">' . "\n", esc_url( get_theme_file_uri( 'assets/theme.css' ) ) );
		if ( is_admin_bar_showing() ) {
			/* ログイン中は管理バーのぶんだけ固定ナビを下げる */
			echo "<style>.admin-bar .site-nav{margin-top:32px}@media screen and (max-width:782px){.admin-bar .site-nav{margin-top:46px}}</style>\n";
		}
	},
	30
);

/* ---- フッター：ページ固有のインライン JS → theme.js（enqueue 済み・優先度 20 で出力） ---- */
add_action(
	'wp_footer',
	function () {
		linplan_part( 'scripts' );
	},
	5
);

/* 子ページへ送るだけの親ページ（/area/ → /area/funabashi/） */
add_action(
	'template_redirect',
	function () {
		if ( ! is_page() ) {
			return;
		}
		$target = get_post_meta( get_queried_object_id(), '_linplan_redirect', true );
		if ( $target ) {
			wp_safe_redirect( home_url( $target ), 302 );
			exit;
		}
	}
);
