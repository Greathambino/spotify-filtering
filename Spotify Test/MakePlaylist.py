import requests
from urllib.parse import urlencode
import base64
import webbrowser

# ** does this stuff change?
ClientID = 'd123e036b11744ea877fc1c34baeac0e'
ClientSecret = 'ca2c6198846e4110b340666917ad9d2f'
RedirectURL = 'http://localhost:7777/callback'

# auth_headers = {
#     "client_id": ClientID,
#     "response_type": "code",
#     "redirect_uri": RedirectURL,
#     "scope": "user-library-read"
# }

# # this is diff from AuthToken
AuthCode = 'AQDusGKYQIAdbt0cGxF9gkYSaGHQU_oROb3Qv2RYCl60mKashw6Rfn0Bj9HiSyJLbp1qPMIM5xEkck6x4sC7fMK8nwYWSKbCco2O0QeCHX0PNp_X2twPn29_pZl-j83wD5l0ssDct-gw-TfJWUtcoN09oBky-U_49GOTOcJo68cxZkOK0G49qswiwXpKXxUnq6BjlyY'

# encoded_credentials = base64.b64encode(ClientID.encode() + b':' + ClientSecret.encode()).decode("utf-8")

# token_headers = {
#     "Authorization": "Basic " + encoded_credentials,
#     "Content-Type": "application/x-www-form-urlencoded"
# }

# token_data = {
#     "grant_type": "authorization_code",
#     "code": AuthCode,
#     "redirect_uri": RedirectURL
# }




# ** not sure what this was for
# folder/90cb2cd69b047524

# ** what is this code below?
# curl --request GET \
#     'https://api.spotify.com/v1/tracks/2TpxZ7JUBn3uw46aR7qd6V' \
#      --header "Authorization: Bearer NgCXRK...MzYjw"

EndPointPrefix = 'https://api.spotify.com/v1/'
URLCREATEPLAYLISTSuffix = 'users/gummyland1/playlists/'


def create_playlist_on_spotify(name, public):
    response = requests.post(EndPointPrefix+URLCREATEPLAYLISTSuffix,
        headers = {
            "Authorization": f"Bearer {AuthToken}"
        },
        json = {
            "name": name,
            "public": public
        }
    )
    json_resp = response.json()
    return json_resp

# This is my empty TestPlaylist's URL
# https://open.spotify.com/playlist/7xMTLLmwDaNMMAs0P1xiVo?si=37ae70223cfd4535

# def get_playlist ():
#     response = requests.get("https://api.spotify.com/v1/playlists/7xMTLLmwDaNMMAs0P1xiVo?si=37ae70223cfd4535",
#         headers = {
#             "Authorization": f"Bearer {AccessTokenGetAllPlaylists}"
#         },
#         json = {
#             "playlist_id": "7xMTLLmwDaNMMAs0P1xiVo?si=37ae70223cfd4535"
#         })
#     json_resp = response.json()
#     return json_resp





def main():
    # webbrowser.open("https://accounts.spotify.com/authorize?" + urlencode(auth_headers))
    # r = requests.post("https://accounts.spotify.com/api/token", data=token_data, headers=token_headers)
    # print(r)
    
    # # token = r.json()["access_token"]
    # print(token)

    playlist = create_playlist_on_spotify(
        name="Test Playlist",
        public = False
    )
    print(f'Playlist: {playlist}')
    
    # playlist2 = get_playlist()
    # print(f'Playlist2: {playlist2}')

    # playlists = get_playlists(50)
    # print(playlists)




if __name__ == '__main__':
    main()


