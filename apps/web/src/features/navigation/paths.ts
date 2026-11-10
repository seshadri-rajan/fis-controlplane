// Every route, link and redirect is built from BASE_PATH, so the prefix only ever changes here.
export const BASE_PATH = "/controlPlane";

export const HOME_PATH = BASE_PATH;
export const METADATA_PATH = `${BASE_PATH}/metadata`;
export const CALENDAR_PATH = `${BASE_PATH}/calendar`;
export const CALENDARS_PATH = `${CALENDAR_PATH}/calendars`;
export const CREATE_PATH = `${CALENDAR_PATH}/create`;
