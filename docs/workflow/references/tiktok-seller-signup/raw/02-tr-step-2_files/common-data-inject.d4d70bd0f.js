/**
 * Please do not import any other packages into this file.
 * This file will import as an iife in the end of head tag.
 */
(function () {
  // ------------------------------Common Get Prefetch-------------------------
  var SHOP_REGION_PARAM = 'shop_region';
  var COOKIE_KEY = 'current_shop_region';
  var COMMON_GET_VERSION = 'common_get_version'
  var ENVS = window.__SELLER_APP_ENVS__ ?? {};
  var APP_ID = ENVS.app_id || process.env.DEPRECATED_APP_ID;
  var REGION_NAME =
    ENVS.region_name ??
    (process.env.REGION === 'FANS' ? 'CB' : process.env.REGION);

  function getShopRegion() {
    var urlRegion = new URLSearchParams(window.location.search).get(
      SHOP_REGION_PARAM,
    );
    if (urlRegion === 'undefined') {
      urlRegion = '';
    }

    var cookieRegion = window.localStorage.getItem(COOKIE_KEY);
    if (cookieRegion === 'undefined') {
      cookieRegion = '';
    }

    try {
      // 优先使用 url region，放弃 cookie region
      if (!urlRegion) {
        var hostname = window.location.hostname || '';
        var hostMatch = hostname.match(/^seller-([a-z0-9-]+)\.tiktok\.com$/i);
        // 目前有部分功能的跳转链接，是跳转过程中参数中没有携带 shop_region, 所以导致 从 MPA 跳到 SPA， SPA下会有 common/get
        // 没有带 shop_region 请求的情况，在EU互通下，host 可能会发生变化
        // MPA -> SPA region 可能没有，也可能是错的
        if (hostMatch && hostMatch[1]) {
          const regionFromHost = hostMatch[1].toUpperCase();
          if (['DE', 'IT', 'ES', 'FR', 'IE', 'PL', 'NL', 'BE', 'AT', 'GR', 'HU', 'CZ', 'PT'].includes(regionFromHost)) {
            if (cookieRegion !== regionFromHost) {
              cookieRegion = regionFromHost
              window.localStorage.setItem(COOKIE_KEY, regionFromHost)
            }
          }
        }
      }
    } catch (e) {
    }

    return urlRegion || cookieRegion || '';
  }

  function getCommonVersion() {
    return parseInt(window.localStorage.getItem(COMMON_GET_VERSION) || '2');
  }

  function request(url, params) {
    var queryString = new URLSearchParams(params).toString();
    var fullUrl = url + '?' + queryString;
    var beginTime = Date.now(); // 捕获开始时间
    return window
      .fetch(fullUrl, {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
      })
      .then(data => {

        const code = data.status;
        const apiErrorLevel =
          data.headers.get('x-tt-oec-error-level') || undefined;
        const logId = data.headers.get('x-tt-logid') || undefined;

        const reportMeta = {
          url: fullUrl,
          begin: beginTime,
          end: Date.now(),
          cost: Date.now() - beginTime,
          logId: logId,
          httpStatus: code,
          apiErrorLevel: apiErrorLevel,
        }

        if (!data.ok) {
          throw new Error(`HTTP Error: ${data.status} ${data.statusText}`);
        }

        return data.json().then(data => ({
          reportMeta,
          ...data,
        }));
      });
  }

  function getQueryParam(key) {
    var queryString = window.location.search;
    if (!queryString) {
      return undefined;
    }
    if (queryString.charAt(0) === '?') {
      queryString = queryString.substring(1);
    }
    var params = queryString.split('&');
    for (var i = 0; i < params.length; i++) {
      var param = params[i].split('=');
      var decodedKey = decodeURIComponent(param[0]);
      var decodedValue = param.length > 1 ? decodeURIComponent(param[1]) : '';
      if (decodedKey === key) {
        return decodedValue;
      }
    }
    return undefined;
  }

  function getCurrentGlobalSeller () {
    var NextGlobalSellerQueryKey = '__next_global_seller__';
    return getQueryParam(NextGlobalSellerQueryKey)
  };

  (function getCommonData() {
    var version = getCommonVersion() || 2
    var params = {
      need_verify_account: true,
      default_region: getShopRegion(),
      version,
    };
    var nextGlobalSellerId = getCurrentGlobalSeller();
    if (nextGlobalSellerId) {
      params.global_seller_id = nextGlobalSellerId
    }
    window.__SELLER_COMMON_GET_RES__ = request(
      `/api/v${version}/seller/common/get`,
      params,
    );
  })();

  (function getAccount() {
    var params = {
      aid: APP_ID,
      language: 'en',
      get_info_type: 2,
    };
    window.__SELLER_PASSPORT_ACCOUNT_INFO_RES__ = request(
      '/passport/account/info/v2/',
      params,
    ).then(r => r.data || {});
  })();

  function getMenu(seller_id) {
    var menuParams = {
      aid: APP_ID,
      oec_seller_id: seller_id,
    };
    window.__SELLER_MENU_RES__ = request('/api/v2/seller/menu/get', menuParams);
  }

  window.__SELLER_COMMON_GET_RES__?.then(data => {
    var sellerId = data?.data?.seller?.seller_id;
    sellerId && getMenu(sellerId);
  });
})();
