<?php
/**
 * 相談室の記事（投稿）
 *
 * 本文（結論ボックス・目次・本文・FAQ）は投稿の本文そのもの。
 * 見出し・著者欄・CTA・関連記事はこのテンプレートが出す。
 */

get_header();

while ( have_posts() ) :
	the_post();
	$lp_post       = get_post();
	$lp_cat        = linplan_cat_label( $lp_post, '_linplan_head_cat' );
	$lp_crumb      = get_post_meta( $lp_post->ID, '_linplan_crumb', true );
	$lp_title_html = get_post_meta( $lp_post->ID, '_linplan_title_html', true );
	$lp_cta_title  = get_post_meta( $lp_post->ID, '_linplan_cta_title', true );
	$lp_cta_text   = get_post_meta( $lp_post->ID, '_linplan_cta_text', true );
	$lp_cta_button = get_post_meta( $lp_post->ID, '_linplan_cta_button', true );
	$lp_related    = linplan_related_posts( $lp_post );

	/* 管理画面でタイトルを書き換えたら、改行位置つきの旧タイトルは使わない */
	if ( $lp_title_html && wp_strip_all_tags( $lp_title_html ) !== $lp_post->post_title ) {
		$lp_title_html = '';
	}
	?>
<main>
  <div class="post-wrap">
    <nav class="post-breadcrumb"><a href="<?php linplan_url( '/' ); ?>">ホーム</a> ／ <a href="<?php linplan_url( '/blog/' ); ?>">相談室</a> ／ <?php echo esc_html( $lp_crumb ? $lp_crumb : get_the_title() ); ?></nav>
  </div>

  <article>
   <div class="post-wrap">
    <header class="post-head">
<?php if ( $lp_cat ) : ?>
      <span class="post-head__cat"><?php echo esc_html( $lp_cat ); ?></span>
<?php endif; ?>
      <h1 class="post-head__title"><?php echo $lp_title_html ? wp_kses_post( $lp_title_html ) : esc_html( get_the_title() ); ?></h1>
      <div class="post-head__meta"><span>公開 <time datetime="<?php echo esc_attr( get_the_date( 'Y-m-d' ) ); ?>"><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></time></span><span>更新 <time datetime="<?php echo esc_attr( get_the_modified_date( 'Y-m-d' ) ); ?>"><?php echo esc_html( get_the_modified_date( 'Y.m.d' ) ); ?></time></span><span>約<?php echo (int) linplan_minutes( $lp_post ); ?>分で読めます</span><?php if ( $lp_cat ) : ?><span>カテゴリ：<?php echo esc_html( $lp_cat ); ?></span><?php endif; ?></div>
    </header>

	<?php the_content(); ?>

    <!-- 著者 -->
	<?php linplan_part( 'author' ); ?>

    <!-- CTA -->
    <div class="post-cta">
      <p class="post-cta__ttl"><?php echo $lp_cta_title ? wp_kses_post( $lp_cta_title ) : 'ホームページのこと、一緒に考えませんか'; ?></p>
      <p class="post-cta__txt"><?php echo $lp_cta_text ? wp_kses_post( $lp_cta_text ) : 'ご相談・お見積もりは無料です。しつこい営業は一切しません。'; ?></p>
      <a href="<?php linplan_url( '/contact/' ); ?>" class="btn btn--primary"><?php echo esc_html( $lp_cta_button ? $lp_cta_button : '無料で相談する' ); ?></a>
    </div>

<?php if ( $lp_related ) : ?>
    <!-- 関連記事 -->
    <section class="post-related">
      <h2 class="post-related__ttl">あわせて読みたい</h2>
      <div class="blog-grid">
	<?php linplan_simple_cards( $lp_related, false, false ); ?>
      </div>
    </section>
<?php endif; ?>
   </div>
  </article>
</main>
	<?php
endwhile;

get_footer();
