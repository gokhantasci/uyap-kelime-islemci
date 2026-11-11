<?php
/**
 * Plugin Name: UYAP Kelime İşlemci (Web UDF Düzenleyici & Görüntüleyici)
 * Plugin URI: https://udf.657.com.tr
 * Description: WordPress sitenize tek satırla UYAP UDF doküman görüntüleyici ve düzenleyici ekler. [uyap_editor] ve [uyap_viewer src="..."] kısa kodlarını destekler.
 * Version: 2.6.0
 * Author: 657.com.tr
 * Author URI: https://657.com.tr
 * License: MIT
 * Text Domain: uyap-kelime-islemci
 */

if (!defined('ABSPATH')) {
    exit;
}

class UyapKelimeIslemciPlugin {
    const EMBED_URL = 'https://udf.657.com.tr/embed.html';

    public function __construct() {
        add_shortcode('uyap_editor', array($this, 'render_editor_shortcode'));
        add_shortcode('uyap_viewer', array($this, 'render_viewer_shortcode'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }

    /**
     * [uyap_editor width="100%" height="700px" theme="light"]
     */
    public function render_editor_shortcode($atts) {
        $a = shortcode_atts(array(
            'width' => '100%',
            'height' => '700px',
            'theme' => 'light',
            'src' => ''
        ), $atts, 'uyap_editor');

        $query = array(
            'mode' => 'editor',
            'theme' => sanitize_text_field($a['theme'])
        );
        if (!empty($a['src'])) {
            $query['src'] = esc_url_raw($a['src']);
        }

        $url = add_query_arg($query, self::EMBED_URL);

        return sprintf(
            '<div class="uyap-embed-container" style="width:%s; margin:16px 0;">
                <iframe src="%s" width="100%%" height="%s" style="border:1px solid #cbd5e1; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.06);" allowfullscreen loading="lazy"></iframe>
            </div>',
            esc_attr($a['width']),
            esc_url($url),
            esc_attr($a['height'])
        );
    }

    /**
     * [uyap_viewer src="https://site.com/karar.udf" width="100%" height="650px" theme="light"]
     */
    public function render_viewer_shortcode($atts) {
        $a = shortcode_atts(array(
            'src' => '',
            'width' => '100%',
            'height' => '650px',
            'theme' => 'light'
        ), $atts, 'uyap_viewer');

        $query = array(
            'mode' => 'viewer',
            'theme' => sanitize_text_field($a['theme'])
        );
        if (!empty($a['src'])) {
            $query['src'] = esc_url_raw($a['src']);
        }

        $url = add_query_arg($query, self::EMBED_URL);

        return sprintf(
            '<div class="uyap-embed-container" style="width:%s; margin:16px 0;">
                <iframe src="%s" width="100%%" height="%s" style="border:1px solid #cbd5e1; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.06);" allowfullscreen loading="lazy"></iframe>
            </div>',
            esc_attr($a['width']),
            esc_url($url),
            esc_attr($a['height'])
        );
    }

    public function add_admin_menu() {
        add_options_page(
            'UYAP Kelime İşlemci Ayarları',
            'UYAP Kelime İşlemci',
            'manage_options',
            'uyap-kelime-islemci',
            array($this, 'render_admin_page')
        );
    }

    public function render_admin_page() {
        ?>
        <div class="wrap">
            <h1>⚖️ UYAP Kelime İşlemci (Web UDF) Ayarları</h1>
            <p>WordPress yazı ve sayfalarınıza doğrudan UYAP UDF editörü veya görüntüleyicisi eklemek için aşağıdaki kısa kodları kullanabilirsiniz:</p>
            
            <h2>Kullanım Örnekleri</h2>
            <table class="widefat fixed striped" style="max-width:800px; margin-top:12px;">
                <thead>
                    <tr>
                        <th style="width:260px;">Kısa Kod (Shortcode)</th>
                        <th>Açıklama</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>[uyap_editor]</code></td>
                        <td>Tam özellikli UYAP web kelime işlemcisini sayfaya gömer.</td>
                    </tr>
                    <tr>
                        <td><code>[uyap_viewer src="https://ornek.com/karar.udf"]</code></td>
                        <td>Belirtilen UDF veya DOCX belgesini güvenli ve salt okunur olarak görüntüler.</td>
                    </tr>
                    <tr>
                        <td><code>[uyap_editor height="800px" theme="dark"]</code></td>
                        <td>Koyu tema ile 800 piksel yükseklikte editör açar.</td>
                    </tr>
                </tbody>
            </table>

            <p style="margin-top:20px;">
                <a href="https://udf.657.com.tr" target="_blank" class="button button-primary">Web Editörü Aç</a>
            </p>
        </div>
        <?php
    }
}

new UyapKelimeIslemciPlugin();
