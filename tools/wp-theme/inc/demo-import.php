<?php
/**
 * 初回セットアップ（テーマを有効化したときに 1 回だけ実行）
 *
 * ローカルでの確認用に、Zip を入れて有効化するだけで静的サイトと同じ構成になるようにする：
 *   1. 固定ページを作る（本文はテーマの parts/ にあるので、ページ自体は「入れ物」）
 *   2. 相談室のカテゴリと記事（data/posts.json）を「投稿」として取り込む
 *   3. 表示設定（ホームページ＝トップページ／投稿ページ＝相談室）とパーマリンク（/blog/%postname%/）を合わせる
 *
 * 同じスラッグのページ・記事が既にあれば作らない。やり直すときは
 * オプション linplan_demo_imported を削除してテーマを有効化し直す。
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'after_switch_theme', 'linplan_demo_import' );

function linplan_demo_import() {
	if ( get_option( 'linplan_demo_imported' ) ) {
		return;
	}
	$site  = linplan_data( 'site' );
	$posts = linplan_data( 'posts' );
	if ( empty( $site['pages'] ) ) {
		return;
	}

	/* 記事本文の SVG や style 属性を落とさない（権限のないコンテキストで有効化されても同じ結果にする） */
	kses_remove_filters();

	/* ---- 1. 固定ページ ---- */
	$page_ids = array();
	foreach ( $site['pages'] as $page ) {
		$existing = get_page_by_path( $page['path'] );
		if ( $existing ) {
			$id = $existing->ID;
		} else {
			$parent = dirname( $page['path'] );
			$id     = wp_insert_post(
				wp_slash(
					array(
						'post_type'    => 'page',
						'post_status'  => 'publish',
						'post_title'   => $page['title'],
						'post_name'    => basename( $page['path'] ),
						'post_parent'  => ( '.' !== $parent && isset( $page_ids[ $parent ] ) ) ? $page_ids[ $parent ] : 0,
						'post_content' => empty( $page['part'] ) ? '' : '<!-- このページの本文はテーマ内の parts/' . $page['part'] . '/main.php にあります（管理画面からは編集できません） -->',
					)
				)
			);
		}
		if ( ! $id || is_wp_error( $id ) ) {
			continue;
		}
		$page_ids[ $page['path'] ] = $id;
		if ( ! empty( $page['part'] ) && ! get_post_meta( $id, '_linplan_part', true ) ) {
			update_post_meta( $id, '_linplan_part', $page['part'] );
		}
		if ( ! empty( $page['redirect'] ) ) {
			update_post_meta( $id, '_linplan_redirect', $page['redirect'] );
		}
	}

	/* ---- 2. カテゴリと記事 ---- */
	$cat_ids = array();
	foreach ( $site['categories'] as $cat ) {
		$term = term_exists( $cat['slug'], 'category' );
		if ( ! $term ) {
			$term = wp_insert_term( $cat['name'], 'category', array( 'slug' => $cat['slug'] ) );
		}
		if ( ! is_wp_error( $term ) ) {
			$cat_ids[ $cat['slug'] ] = (int) $term['term_id'];
		}
	}

	/* 更新日（post_modified）は通常「いま」になるので、静的サイトの dateModified を入れる */
	$keep_modified = function ( $data, $postarr ) {
		if ( ! empty( $postarr['linplan_modified'] ) ) {
			$data['post_modified']     = $postarr['linplan_modified'];
			$data['post_modified_gmt'] = get_gmt_from_date( $postarr['linplan_modified'] );
		}
		return $data;
	};
	add_filter( 'wp_insert_post_data', $keep_modified, 10, 2 );

	foreach ( $posts as $post ) {
		if ( get_page_by_path( $post['slug'], OBJECT, 'post' ) ) {
			continue;
		}
		$meta = array();
		foreach ( $post['meta'] as $key => $value ) {
			$meta[ $key ] = is_string( $value ) ? linplan_fill( $value ) : $value;
		}
		/* JSON-LD はサイトの URL が変わっても追従できるよう、プレースホルダーのまま保存する */
		if ( isset( $post['meta']['_linplan_jsonld'] ) ) {
			$meta['_linplan_jsonld'] = $post['meta']['_linplan_jsonld'];
		}

		$id = wp_insert_post(
			wp_slash(
				array(
					'post_type'        => 'post',
					'post_status'      => 'publish',
					'post_title'       => $post['title'],
					'post_name'        => $post['slug'],
					'post_excerpt'     => $post['excerpt'],
					'post_content'     => linplan_fill( $post['content'] ),
					'post_date'        => $post['date'],
					'post_date_gmt'    => get_gmt_from_date( $post['date'] ),
					'linplan_modified' => $post['modified'],
					'post_category'    => isset( $cat_ids[ $post['category'] ] ) ? array( $cat_ids[ $post['category'] ] ) : array(),
					'meta_input'       => $meta,
				)
			),
			true
		);
		if ( ! is_wp_error( $id ) && ! empty( $post['featured'] ) ) {
			stick_post( $id );
		}
	}
	remove_filter( 'wp_insert_post_data', $keep_modified, 10 );
	kses_init();

	/* WordPress 初期インストールのサンプル投稿はゴミ箱へ（復元できる） */
	$hello = get_post( 1 );
	if ( $hello && 'post' === $hello->post_type && 'hello-world' === $hello->post_name ) {
		wp_trash_post( $hello->ID );
	}

	/* ---- 3. 表示設定とパーマリンク ---- */
	if ( isset( $page_ids['home'], $page_ids['blog'] ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $page_ids['home'] );
		update_option( 'page_for_posts', $page_ids['blog'] );
	}
	global $wp_rewrite;
	$wp_rewrite->set_permalink_structure( '/blog/%postname%/' );
	update_option( 'linplan_flush_rewrite', 1 );

	update_option( 'linplan_demo_imported', LINPLAN_VERSION );
}

/*
 * リライトルールの作り直しは「次のリクエスト」で行う。
 * 有効化したリクエストの中では、カテゴリなどの URL 構造がまだ古いパーマリンク設定で登録されているため、
 * その場で flush すると /blog/category/… が 404 になる。
 */
add_action(
	'init',
	function () {
		if ( get_option( 'linplan_flush_rewrite' ) && ! did_action( 'after_switch_theme' ) ) {
			delete_option( 'linplan_flush_rewrite' );
			flush_rewrite_rules();
		}
	},
	100
);
