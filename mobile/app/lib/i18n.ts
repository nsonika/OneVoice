import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";

import en from "../i18n/en.json";
import hi from "../i18n/hi.json";
import ta from "../i18n/ta.json";
import te from "../i18n/te.json";
import kn from "../i18n/kn.json";

const i18n = new I18n({ en, hi, ta, te, kn });

i18n.defaultLocale = "en";
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? "en";

export default i18n;
