<?php
/**
 * 固定ページ
 *
 * 静的サイトから取り込んだページは parts/{key}/main.php をそのまま出す。
 * 管理画面で新しく作ったページ（parts を持たない）は、記事と同じ体裁で本文を出す。
 */

get_header();

if ( ! linplan_part( 'main' ) ) :
	while ( have_posts() ) :
		the_post();
		?>
<main>
  <div class="post-wrap">
    <nav class="post-breadcrumb"><a href="<?php linplan_url( '/' ); ?>">ホーム</a> ／ <?php the_title(); ?></nav>
  </div>
  <article>
   <div class="post-wrap">
    <header class="post-head">
      <h1 class="post-head__title"><?php the_title(); ?></h1>
    </header>
    <div class="post-body">
		<?php the_content(); ?>
    </div>
   </div>
  </article>
</main>
		<?php
	endwhile;
endif;

get_footer();
