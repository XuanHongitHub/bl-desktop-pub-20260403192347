'use strict';

(function () {
    window.__FP_BEGIN__ = new Date();
    var thisTag = document.getElementById('seller-pre-inject');
    var contentLoadedRegion = document.getElementById('content_loaded_region');
    // ------------------ Inject m4b theme-----------------------------------
    function setCookie(key, value) {
        var hostSegments = location.host.split('.');
        document.cookie =
            key +
                '=' +
                value +
                '; domain=.' +
                hostSegments.slice(hostSegments.length - 2).join('.') +
                '; path=/; max-age=604800';
    }
    setCookie('_m4b_theme_', 'new');
    var htmlElement = document.querySelector('html');
    htmlElement?.setAttribute('data-m4b-theme', 'theme-m4b-next');
    // --------------------- public url adaptation ---------------------------------
    if (thisTag) {
        window.__publicUrl__ = thisTag.getAttribute('data-public-url');
        window.__publicUrl_new__ = thisTag.getAttribute('data-public-url-new');
    }
    // --------------------- s2d adaption ----------------------------------
    ['gfdatav1', '__SELLER_APP_ENVS__'].forEach((k) => {
        if (document.getElementById(k) instanceof HTMLElement) {
            try {
                // @ts-ignore
                window[k] = JSON.parse(window[k].innerText);
            }
            catch (e) {
                console.warn('[pre-inject] failed to parse json from ' + k);
            }
        }
    });
    // After upgrading goofy to the serverless version,
    // the region will change. Here is a layer of mapping.
    if (window.gfdatav1 && typeof window.gfdatav1 === 'object') {
        // Here is the `region` field mapping table issued by old and new goofy
        var MAP = {
            sg: 'ALISG',
            maliva: 'MALIVA',
            useastred: 'I18N',
        };
        var region = window.gfdatav1.region;
        if (MAP[region]) {
            window.gfdatav1.originRegion = region;
            window.gfdatav1.region = MAP[region];
        }
    }
    // ---------------------------DOMContentLoaded event---------------------
    if (contentLoadedRegion) {
        var dataRegion = contentLoadedRegion.getAttribute('data-dom-content-loaded-region');
        window.addEventListener('DOMContentLoaded', () => {
            var LOGIN_MODE = 0x201;
            window.byted_acrawler &&
                window.byted_acrawler.init({
                    aid: 4068,
                    isSDK: false,
                    boe: false,
                    region: dataRegion,
                    mode: LOGIN_MODE,
                    enablePathList: [
                        '/api/(?!ba/).*',
                        '/passport/(?!(web/logout)|(sso/login/callback)).',
                        '/check_login/',
                        '/account_login/v3/',
                        '/send_activation_code/v2/',
                        '/send_email_activate_code/v2/',
                        '/auth/login_only/',
                        '/auth/login/',
                        '/activate_email/code_login/',
                        '/quick_login_only/',
                        '/register/',
                        '/activate_email/register/',
                        '/quick_login/v2/',
                        '/reset_password/',
                        '/sms_login_with_bind/',
                        '/email_login_with_bind/',
                        '/agent_login/',
                        '/login_by_ticket/',
                        '/email/send_code/',
                        '/mobile/send_code/',
                        '/email/register/code_verify/',
                        '/mobile/register/code_verify/',
                        '/email/register/ticket_register/',
                        '/password/reset_by_email_ticket/',
                        '/email/check_code/',
                        '/mobile/check_code/',
                        '/password/reset_by_ticket/',
                    ],
                });
        });
    }
    // ------------------------------Slardar event-------------------------------
    try {
        window.addEventListener('load', function () {
            setTimeout(function () {
                var root = document.getElementById('root');
                if (!root || !root.children.length) {
                    window.Slardar &&
                        window.Slardar('Sentry', function (sentry) {
                            sentry.captureMessage('WhiteScreen');
                        });
                }
            }, 3000);
        });
    }
    catch (e) { }
    // ------------------------------ region checker -------------------------------
    const domain = location.hostname;
    const specialRegionCodeMap = {
        UK: 'GB',
    };
    const getDomainRegionCode = () => {
        const reg = /^seller-([^.-]{2})(-[^.]+)*\.(tiktok|tokopedia)\..+$/;
        if (reg.test(domain)) {
            let regionCode = domain.replace(reg, '$1').toUpperCase();
            return specialRegionCodeMap[regionCode] || regionCode;
        }
        return null;
    };
    const domainRegionCode = getDomainRegionCode();
    if (domainRegionCode &&
        window?.__SELLER_APP_ENVS__?.region_name &&
        domainRegionCode !== window.__SELLER_APP_ENVS__.region_name) {
        console.error('%c Seller-Center pre-check: domain and region mismatch !!!', 'background: red; color: white; font-size: 30px;');
        window?.Slardar?.('sendEvent', {
            name: 'region_mismatch',
            categories: {
                domain_region: domainRegionCode,
                app_region: window.__SELLER_APP_ENVS__.region_name,
                domain: domain,
                where: window.location.pathname,
            },
        });
    }
})();
