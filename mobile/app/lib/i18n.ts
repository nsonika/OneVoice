import { getLocales } from "expo-localization";
import { I18n } from "i18n-js";

import en from "../i18n/en.json";
import es from "../i18n/es.json";

const i18n = new I18n({ en, es });

i18n.defaultLocale = "en";
i18n.enableFallback = true;
i18n.locale = getLocales()[0]?.languageCode ?? "en";

export default i18n;
