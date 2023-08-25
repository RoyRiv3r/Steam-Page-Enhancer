// ==UserScript==
// @name          Steam Currency Converter
// @description   Converts prices to your currency of choice.
// @namespace     https://github.com/CoronaBringer/SteamCurrencyConverter
// @version       2.3.2
// @author        CoronaBringer
// @source        https://github.com/CoronaBringer
// @match         *://store.steampowered.com/*
// @match         *://steamcommunity.com/*
// @grant         GM.xmlHttpRequest
// @grant         GM.getValue
// @grant         GM.setValue
// @grant         GM.deleteValue
// @connect       cdn.jsdelivr.net
// @connect       raw.githubusercontent.com
// @run-at        document-start
// @updateURL     https://gist.github.com/CoronaBringer/7e858facfc02a129f586a298ee96531b/raw/steam-currency-converter.meta.js
// @downloadURL   https://gist.github.com/CoronaBringer/7e858facfc02a129f586a298ee96531b/raw/steam-currency-converter.user.js
// @homepageURL   https://github.com/CoronaBringer/SteamCurrencyConverter
// @supportURL    https://github.com/CoronaBringer/SteamCurrencyConverter/issues
// ==/UserScript==

(() => {
  "use strict";

  const fractionDigits = { min: 2, max: 2 };
  const constants = {
    UPDATE_RATE: 432e5,
    CURRENCY_CODES: [
      "ARS",
      "AUD",
      "BGN",
      "BRL",
      "BTC",
      "CAD",
      "CHF",
      "CLP",
      "CNY",
      "CZK",
      "DKK",
      "EGP",
      "EUR",
      "GBP",
      "HKD",
      "HRK",
      "HUF",
      "IDR",
      "ILS",
      "INR",
      "ISK",
      "JPY",
      "KRW",
      "MXN",
      "MYR",
      "NAD",
      "NOK",
      "NZD",
      "PHP",
      "PLN",
      "RON",
      "RUB",
      "SEK",
      "SGD",
      "THB",
      "TRY",
      "TWD",
      "UAH",
      "XAG",
      "XAU",
      "XDR",
      "XPD",
      "XPT",
      "ZAR",
      "USD",
    ],
    CURRENCIES: [
      {
        code: "ARS",
        pattern: /ARS\$\s*([0-9.,]+)/gim,
        groupSeparator: ".",
        decimalSeparator: ",",
        fractionDigits: fractionDigits,
      },
      {
        code: "BRL",
        pattern: /R\$\s*([0-9.,]+)/gim,
        groupSeparator: ".",
        decimalSeparator: ",",
        fractionDigits: fractionDigits,
      },
      {
        code: "TRY",
        pattern: /([0-9.,]+)\sTL/gim,
        groupSeparator: ".",
        decimalSeparator: ",",
        fractionDigits: fractionDigits,
      },
      {
        code: "RUB",
        pattern: /([0-9.,]+)\spуб./gim,
        groupSeparator: ".",
        decimalSeparator: ",",
        fractionDigits: fractionDigits,
      },
    ],
    OBSERVER_CONFIG: {
      attributes: false,
      childList: true,
      subtree: true,
      characterData: true,
    },
  };
  async function makeRequest(url, options) {
    const request = new Request(url, options);
    let requestBody;

    if (options?.body) {
      requestBody = await request.text();
    }

    return await new Promise((resolve, reject) => {
      GM.xmlHttpRequest({
        url: request.url,
        method: validateMethod(request.method.toUpperCase()),
        headers: formatHeaders(request.headers),
        data: requestBody,
        onload: (response) =>
          resolve(
            new Response(response.responseText, {
              statusText: response.statusText,
              status: response.status,
              headers: parseHeaders(response.responseHeaders),
            })
          ),
        onerror: (error) =>
          reject(new TypeError("Failed to fetch: " + error.finalUrl)),
      });
    });
  }
  const httpMethods = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "HEAD",
    "TRACE",
    "OPTIONS",
    "CONNECT",
  ];

  function validateMethod(method) {
    if (httpMethods.includes(method)) return method;
    throw new Error(`unsupported http method ${method}`);
  }

  function formatHeaders(headers) {
    if (!headers) return;
    const formattedHeaders = {};
    headers.forEach((value, key) => {
      formattedHeaders[key] = value;
    });
    return formattedHeaders;
  }

  function parseHeaders(headerString) {
    const headerArray = headerString
      .trim()
      .split("\r\n")
      .map((header) => {
        let parts = header.split(": ");
        return [parts[0], parts[1]];
      });
    return new Headers(headerArray);
  }

  const scriptName = "SteamCurrencyConverter";

  const logError = (...args) => {
    console.error(`[${scriptName}] error:`, ...args);
  };

  const logInfo = (...args) => {
    console.info(`[${scriptName}] info:`, ...args);
  };

  async function fetchExchangeRates(currencyCode) {
    const lowerCaseCode = currencyCode.toLowerCase();
    const exchangeRates = [];

    const response = await (async function (urls, options = {}) {
      let result;
      for (let url of urls) {
        try {
          logInfo(`fetching exchange rate from ${url}`);
          result = await makeRequest(url, options);
          if (result.ok) return result;
        } catch (error) {}
      }
      return result;
    })([
      `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${lowerCaseCode}.min.json`,
      `https://raw.githubusercontent.com/fawazahmed0/currency-api/1/latest/currencies/${lowerCaseCode}.min.json`,
      `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/${lowerCaseCode}.json`,
      `https://raw.githubusercontent.com/fawazahmed0/currency-api/1/latest/currencies/${lowerCaseCode}.json`,
    ]);

    const jsonData = await response.json();

    exchangeRates.push(
      ...Object.keys(jsonData[lowerCaseCode])
        .filter((code) =>
          constants.CURRENCIES.find(
            (currency) => currency.code.toLowerCase() === code.toLowerCase()
          )
        )
        .map((code) => ({
          code: code.toUpperCase(),
          rate: 1 / parseFloat(jsonData[lowerCaseCode][code]),
        }))
    );

    return exchangeRates;
  }
  function replaceCurrency(node, currency, options) {
    node.nodeValue = node.nodeValue.replace(currency.pattern, (match, amount) =>
      convertCurrency(amount, currency, options)
    );
  }

  function findTextNodes(element, pattern) {
    const textNodes = [];
    let currentNode;
    const treeWalker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      (node) =>
        !node.parentNode ||
        (node.parentNode.nodeName !== "SCRIPT" &&
          node.parentNode.nodeName !== "STYLE" &&
          pattern.test(node.nodeValue))
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP
    );

    while ((currentNode = treeWalker.nextNode())) {
      textNodes.push(currentNode);
    }

    return textNodes;
  }

  function convertCurrency(amount, currency, options) {
    const index = options.exchangeRates.findIndex(
      (rate) => rate.code === currency.code
    );
    if (index === -1) {
      throw new Error(`currency ${currency.code} not found in exchange rates`);
    }

    const exchangeRate = options.exchangeRates[index];
    amount = amount
      .replace(currency.groupSeparator, "")
      .replace(currency.decimalSeparator, ".");
    const rate = exchangeRate.rate;

    return (parseFloat(amount) * rate).toLocaleString("pl-PL", {
      style: "currency",
      currency: options.targetCurrency,
      minimumFractionDigits: currency.fractionDigits.min,
      maximumFractionDigits: currency.fractionDigits.max,
    });
  }

  async function processMutation(mutation, priceNodes, options) {
    const appData = options || (await Storage.get("appData"));
    if (!appData) {
      console.error("No app data found");
      return;
    }

    const targetCurrency = appData.targetCurrency;
    const exchangeRates = appData.exchangeRates;

    for (const currency of constants.CURRENCIES) {
      if (currency.pattern.test(mutation.target.textContent)) {
        const textNodes = findTextNodes(mutation.target, currency.pattern);
        for (const node of textNodes) {
          replaceCurrency(node, currency, {
            targetCurrency: targetCurrency,
            exchangeRates: exchangeRates,
          });
        }
      }
    }
  }

  async function observeMutations(priceNodes) {
    let currencyFound = false;
    const observer = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          if (
            mutation.target instanceof HTMLElement &&
            mutation.target.id === "global_action_menu"
          ) {
            document.dispatchEvent(
              new CustomEvent("globalActionMenuFound", {
                detail: { target: mutation.target, observer: observer },
              })
            );
          }

          for (const currency of constants.CURRENCIES) {
            if (currency.pattern.test(mutation.target.textContent)) {
              currencyFound = true;
            }
          }

          if (currencyFound) {
            await processMutation(mutation, priceNodes, undefined);
            currencyFound = false;
          }
        }
      }
    });

    observer.observe(document, constants.OBSERVER_CONFIG);
  }

  class Storage {
    static async get(key) {
      let value = await GM.getValue(key);
      if (typeof value === "string") {
        try {
          value = JSON.parse(value);
        } catch (error) {}
      }
      return value;
    }

    static async set(key, value) {
      const jsonString = JSON.stringify(value);
      await GM.setValue(key, jsonString);
    }

    static async delete(key) {
      await GM.deleteValue(key);
    }
  }

  async function showDialog() {
    const dialogReady = await (async function () {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (
            typeof unsafeWindow.ShowPromptDialog === "function" &&
            typeof unsafeWindow.jQuery === "function"
          ) {
            clearInterval(interval);
            resolve(true);
          }
        }, 100);
      });
    })();

    return new Promise(function (resolve, reject) {
      if (!dialogReady) {
        reject("dialog not ready");
      }

      const dialog = unsafeWindow.ShowPromptDialog(
        "Select Currency",
        "Select the currency you want to use for prices",
        "Save",
        "Cancel"
      );

      const selectElement = `<select style="outline:none; background: #1e2226; border:1px solid #000; box-shadow:1px 1px 0 0 rgba(91, 132, 181, 0.2); font-size:13px; color:#BFBFBF; width:100%;" onchange="this.parentNode.querySelector('input').value = this.value"><option value="" style="color:#BFBFBF" >Select...</option>${constants.CURRENCY_CODES.map(
        (code) => '<option style="color:#BFBFBF">' + code + "</option>"
      ).join("")}</select>`;

      jQuery("input", dialog.m_$StandardContent)
        .css("display", "none")
        .after(selectElement);
      dialog.done((result) => {
        resolve(result);
      });
    });
  }

  function createButtons(element, observer) {
    const storePages = [
      {
        url: "https://www.gog.com/fr/games?query=",
        urlSpecial: "&order=desc%3Ascore",
        title: "GOG",
      },
      {
        url: "https://www.ea.com/games/library/",
        title: "EA",
      },
      {
        url: "https://www.xbox.com/en-us/Search/Results?q=",
        title: "XBOX",
      },
      {
        url: "https://store.epicgames.com/en-US/browse?q=",
        urlSpecial: "&sortBy=relevancy&sortDir=DESC&count=40",
        title: "EPIC",
      },
    ];
    const pirateLinks = [
      {
        url: "https://gload.to/?s=",
        urlSpecial: "",
        title: "Gload",
      },
      {
        url: "https://gog-games.com/search/",
        urlSpecial: "",
        title: "GOG Games",
      },
      {
        url: "https://www.ovagames.com/?s=",
        urlSpecial: "",
        title: "OVA Games",
      },
      {
        url: "https://steamrip.com/?s=",
        urlSpecial: "",
        title: "SteamRIP",
      },
      {
        url: "https://steamunlocked.net/?s=",
        urlSpecial: "",
        title: "Steam Unlocked",
      },
      {
        url: "https://gogunlocked.com/?s=",
        urlSpecial: "",
        title: "GOG Unlocked",
      },
      {
        url: "https://fitgirl-repacks.site/?s=",
        urlSpecial: "",
        title: "Fitgirl",
      },
      {
        url: "https://cs.rin.ru/forum/search.php?keywords=",
        urlSpecial:
          "&terms=any&author=&sc=1&sf=titleonly&sk=t&sd=d&sr=topics&st=0&ch=300&t=0&submit=Search",
        title: "CS.RIN.RU",
      },
      {
        url: "https://www.downloadha.com/?s=",
        urlSpecial: "",
        title: "DownloadHa",
      },
    ];
    const createButton = (linkInfo) => {
      const link = document.createElement("a");

      link.className = "btnv6_blue_hoverfade btn_medium";
      link.style.cursor = "pointer";
      link.target = "_blank";
      link.title = linkInfo.title;

      const img = document.createElement("img");
      img.classList.add("ico16");
      img.classList.add("csrinru-icon");
      img.src =
        "https://www.google.com/s2/favicons?sz=16&domain=" +
        linkInfo.url.toLowerCase();
      img.style.marginRight = "5px";

      link.appendChild(img);

      // Add the title text next to the icon
      const titleText = document.createTextNode(linkInfo.title);
      link.appendChild(titleText);
      // Use flexbox to align the content
      link.style.display = "flex";
      link.style.alignItems = "center";
      link.style.padding = "0 15px";
      link.style.fontSize = "15px";
      link.style.lineHeight = "30px";
      // Apply the provided CSS styles
      link.style.borderRadius = "2px";
      link.style.border = "none";
      // link.style.padding = "1px";
      link.style.display = "inline-block";
      link.style.textDecoration = "none";
      link.style.color = "#67c1f5";
      link.style.backgroundColor = "rgba(103, 193, 245, 0.2)";
      link.style.margin = "2px 2px";
      link.style.font = "font-family: Arial, Helvetica, sans-serif";
      link.addEventListener("mouseover", () => {
        link.style.color = "#fff";
        link.style.backgroundColor = "#417a9b";
        link.style.backgroundImage =
          "linear-gradient(-60deg, #417a9b 5%, #67c1f5 95%)";
      });

      link.addEventListener("mouseout", () => {
        link.style.color = "#67c1f5";
        link.style.backgroundColor = "rgba(103, 193, 245, 0.2)";
        link.style.backgroundImage = "none";
      });

      link.addEventListener("click", () => {
        let gameTitle = document.querySelector("#appHubAppName").textContent;
        console.log("Game title 1st line:", gameTitle);
        // Remove extra whitespace
        gameTitle = gameTitle.trim().replace(/\s+/g, " ");

        // Replace special characters with hyphens
        gameTitle = gameTitle.replace(/[^\w\s]/gi, "-");

        // Convert to lowercase
        gameTitle = gameTitle.toLowerCase();

        // Encode the game title using encodeURIComponent()
        gameTitle = encodeURIComponent(gameTitle);
        console.log("Game title 2nd line:", gameTitle);
        window.open(
          linkInfo.url + gameTitle + (linkInfo.urlSpecial || ""),
          "_blank"
        );

        console.log("URL:", linkInfo.url);
        console.log("Game 3rd title:", gameTitle);
        console.log("URL Special:", linkInfo.urlSpecial);
      });
      const container = document.createElement("div");
      container.style.display = "inline-block";
      container.appendChild(link);
      return container;
    };
    const createButtonGroup = (title, links) => {
      const groupContainer = document.createElement("div");
      groupContainer.style.border = "2px solid #171a21";
      groupContainer.style.borderRadius = "4px";
      groupContainer.style.padding = "5px";
      groupContainer.style.marginTop = "5px"; // Reduce the margin-top
      groupContainer.style.maxWidth = "36%";
      groupContainer.style.marginLeft = "auto";
      groupContainer.style.marginRight = "auto";

      const groupLabel = document.createElement("div");
      groupLabel.textContent = title;
      groupLabel.style.fontWeight = "bold";
      groupLabel.style.marginBottom = "5px";
      groupLabel.style.color = "white"; // Set the text color of the container to white
      groupContainer.appendChild(groupLabel);

      const buttonsContainer = document.createElement("div");
      buttonsContainer.style.display = "flex";
      buttonsContainer.style.flexWrap = "wrap";
      buttonsContainer.style.justifyContent = "center";
      buttonsContainer.style.gap = "4px"; // Reduce the space between buttons
      groupContainer.appendChild(buttonsContainer);

      links.forEach((linkInfo) => {
        const button = createButton(linkInfo);
        buttonsContainer.appendChild(button);
      });

      return groupContainer;
    };
    const storePageButtonsDiv = createButtonGroup("Store Pages", storePages);
    element.appendChild(storePageButtonsDiv);

    const pirateLinksButtonsDiv = createButtonGroup(
      "Pirate Links",
      pirateLinks
    );
    element.appendChild(pirateLinksButtonsDiv);

    observer.disconnect();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const targetElement = document.querySelector(".game_background_glow");
    if (targetElement) {
      const observer = new MutationObserver(() => {});
      createButtons(targetElement, observer);
    }
  });

  async function updateExchangeRates(options) {
    logInfo("updating exchange rates");
    const rates = await fetchExchangeRates(options.targetCurrency);
    if (!rates) {
      logError("no exchange rates");
    }
    options.exchangeRates = rates;
    options.lastUpdate = Date.now();
  }

  function submitForm(url, data) {
    const form = document.createElement("form");
    form.target = "_blank";
    form.method = "POST";
    form.action = url;
    form.style.display = "none";

    for (const key in data) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = data[key];
      form.appendChild(input);
    }

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }
  (async function () {
    let priceNodes = [];
    await observeMutations(priceNodes);

    (async function () {
      let appData = await Storage.get("appData");

      if (appData) {
        if (Date.now() - appData.lastUpdate > constants.UPDATE_RATE) {
          logInfo("updating exchange rates");
          await updateExchangeRates(appData);
          await Storage.set("appData", appData);
        }
        return appData;
      }

      let targetCurrency = await showDialog();
      if (targetCurrency) {
        appData = {
          targetCurrency: targetCurrency,
          lastUpdate: Date.now(),
          updateRate: constants.UPDATE_RATE,
        };
        await updateExchangeRates(appData);
        await Storage.set("appData", appData);
        logInfo("refreshing page");
        location.reload();
        return appData;
      }

      logError("no currency code");
    })().then((appData) => {
      logInfo("appData", appData);

      document.addEventListener("priceNodesAdded", (event) => {
        let currency = event.detail;
        let nodeCount = priceNodes.length;

        while (nodeCount--) {
          replaceCurrency(priceNodes[nodeCount], currency, appData);
          priceNodes.splice(nodeCount, 1);
        }
      });
    });

    document.addEventListener(
      "globalActionMenuFound",
      (event) => {
        logInfo("injected change currency button");
        const target = event.detail.target;
        const observer = event.detail.observer;
        const link = document.createElement("a");

        link.classList.add("global_action_link");
        link.style.cssText = "vertical-align: middle; cursor: pointer;";
        const text = document.createTextNode("Change Target Currency");
        link.appendChild(text);

        link.addEventListener("click", async () => {
          await Storage.delete("appData");
          location.reload();
        });

        observer.disconnect();
        target.prepend(link);
        observer.observe(document, constants.OBSERVER_CONFIG);
      },
      { once: true }
    );

    // if (location.pathname.match(/app\/(\d+)/)) {
    //   globalActionMenuObserver.observe(document, {
    //     childList: true,
    //     subtree: true,
    //   });
    // }
  })().catch((error) => {
    logError(error);
  });
})();
