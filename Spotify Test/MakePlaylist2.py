import requests
from urllib.parse import urlencode
import base64
import webbrowser

client_id = 'd123e036b11744ea877fc1c34baeac0e'
client_secret = 'ca2c6198846e4110b340666917ad9d2f'
RedirectURL = 'http://localhost:7777/callback'

auth_headers = {
    "client_id": client_id,
    "response_type": "code",
    "redirect_uri": RedirectURL,
    "scope": "user-library-read"
}

webbrowser.open("https://accounts.spotify.com/authorize?" + urlencode(auth_headers))

code = 'AQB61YAlc5eik0qT4-64-bJrv0EMNru8ZRnwafIGGBhFccj1Xxp8Kufv_zbANpkGykVSNQl5DpjAjLf-2A2tmoJt9jLaIQQxvtCH-16u9SDSmqf_R5TNTSL1nC9-MwzxVFsEztf5LzP_df_N5suRb4QxDEtqYq7mEFZAOtjH6k_ptUG-ZJbs1bEhx64SJD3rPqK-y8w'

#------------------------------------------------------------------------------------------------------------


encoded_credentials = base64.b64encode(client_id.encode() + b':' + client_secret.encode()).decode("utf-8")

token_headers = {
    "Authorization": "Basic " + encoded_credentials,
    "Content-Type": "application/x-www-form-urlencoded"
}

token_data = {
    "grant_type": "authorization_code",
    "code": code,
    "redirect_uri": "http://localhost:7777/callback"
}

r = requests.post("https://accounts.spotify.com/api/token", data=token_data, headers=token_headers)

token = r.json()["access_token"]

print(token)

